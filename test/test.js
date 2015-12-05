var Temporal = require('../');
var Sequelize = require('sequelize');
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var assert = chai.assert;
var eventually = assert.eventually;

describe('Read-only API', function(){
  var sequelize, User, UsersHistory;

  function freshDB(){
    // overwrites the old SQLite DB
    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: __dirname + '/.test.sqlite'
    });
    User = Temporal(sequelize.define('User', {
      name: Sequelize.TEXT                        
    }), sequelize);
    UsersHistory = sequelize.models.UsersHistory;
    return sequelize.sync({ force: true });
  }

  function assertCount(modelHistory, n, opts){
    // wrapped, chainable promise
    return function(obj){
      return modelHistory.count(opts).then(function(count){
        assert.equal(n, count, "history entries") 
        return obj;
      });
    }
  }

  describe('hook', function(){
    beforeEach(freshDB);
    it('should save to the historyDB' , function(){
      return User.create()
      .then(assertCount(UsersHistory,0))
      .then(function(user){
        user.name = "foo";
        return user.save();
      }).then(assertCount(UsersHistory,1))
      .then(function(user){
        return user.destroy();
      }).then(assertCount(UsersHistory,2))
    });
  });

  describe('transactions', function(){
    beforeEach(freshDB);
    it('revert on failed transactions' , function(){
      return sequelize.transaction().then(function(t){
        var opts = {transaction: t};
        return User.create(opts)
        .then(assertCount(UsersHistory,0, opts))
        .then(function(user){
          user.name = "foo";
          return user.save(opts);
        }).then(assertCount(UsersHistory,1, opts))
        .then(function(){
          t.rollback();
        });
      }).then(assertCount(UsersHistory,0));
    });
  });

  describe('bulk update', function(){
    beforeEach(freshDB);
    it('should archive every entry' , function(){
      return User.bulkCreate([
        {name: "foo1"},
        {name: "foo2"},
      ]).then(assertCount(UsersHistory,0))
      .then(function(){
        return User.update({ name: 'updated-foo' }, {where: {}});
      }).then(assertCount(UsersHistory,2))
    });
    it('should revert under transactions' , function(){
      return sequelize.transaction().then(function(t){
        var opts = {transaction: t};
        return User.bulkCreate([
          {name: "foo1"},
          {name: "foo2"},
        ], opts).then(assertCount(UsersHistory,0,opts))
        .then(function(){
          return User.update({ name: 'updated-foo' }, {where: {}, transaction: t});
        }).then(assertCount(UsersHistory,2, opts))
        .then(function(){
          t.rollback();
        });
      }).then(assertCount(UsersHistory,0));
    });

  });

  describe('bulk destroy/truncate', function(){
    beforeEach(freshDB);
    it('should archive every entry' , function(){
      return User.bulkCreate([
        {name: "foo1"},
        {name: "foo2"},
      ]).then(assertCount(UsersHistory,0))
      .then(function(){
        return User.destroy({
          where: {},
          truncate: true // truncate the entire table
        });
      }).then(assertCount(UsersHistory,2))
    });
    it('should revert under transactions' , function(){
      return sequelize.transaction().then(function(t){
        var opts = {transaction: t};
        return User.bulkCreate([
          {name: "foo1"},
          {name: "foo2"},
        ], opts).then(assertCount(UsersHistory,0,opts))
        .then(function(){
          return User.destroy({
            where: {},
            truncate: true, // truncate the entire table
            transaction: t
          });
        }).then(assertCount(UsersHistory,2, opts))
        .then(function(){
          t.rollback();
        });
      }).then(assertCount(UsersHistory,0));
    });


  });

  describe('read-only ', function(){
    it('should forbid updates' , function(){
      var userUpdate = UsersHistory.create().then(function(uh){
        uh.update({name: 'bla'});
      });
      return assert.isRejected(userUpdate, Error, "Update error");
    });
    it('should forbid deletes' , function(){
      var userUpdate = UsersHistory.create().then(function(uh){
        uh.destroy();
      });
      return assert.isRejected(userUpdate, Error, "Update error");
    });
  });
})

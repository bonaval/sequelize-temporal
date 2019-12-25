var Temporal = require('../');
var Sequelize = require('sequelize');
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var assert = chai.assert;
var eventually = assert.eventually;

describe('Read-only API', function(){
  var sequelize, User, UserHistory;

  function freshDB(){
    // overwrites the old SQLite DB
    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: __dirname + '/.test.sqlite'
    });
    User = Temporal(sequelize.define('User', {
      name: Sequelize.TEXT
    }), sequelize);
    UserHistory = sequelize.models.UserHistory;
    return sequelize.sync({ force: true });
  }

  function freshDBWithFullModeAndParanoid() {
    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: __dirname + '/.test.sqlite'
    });
    User = Temporal(sequelize.define('User', {
      name: Sequelize.TEXT
    }, { paranoid: true }), sequelize, { full: true });
    UserHistory = sequelize.models.UserHistory;

    return sequelize.sync({ force: true });
  }

  function freshDBWithExcludedFields() {
    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: __dirname + '/.test.sqlite'
    });
    User = Temporal(sequelize.define('User', {
      name: Sequelize.TEXT,
      fieldToExclude: Sequelize.TEXT,
    }, { paranoid: true }), sequelize, { excludeFields: ['fieldToExclude'] });
    UserHistory = sequelize.models.UserHistory;

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

  describe('hooks', function(){
    beforeEach(freshDB);
    it('onCreate: should not store the new version in history db' , function(){
      return User.create({ name: 'test' }).then(assertCount(UserHistory, 0));
    });
    it('onUpdate/onDestroy: should save to the historyDB' , function(){
      return User.create()
      .then(assertCount(UserHistory,0))
      .then(function(user){
        user.name = "foo";
        return user.save();
      }).then(assertCount(UserHistory,1))
      .then(function(user){
        return user.destroy();
      }).then(assertCount(UserHistory,2))
    });
    it('onUpdate: should store the previous version to the historyDB' , function(){
      return User.create({name: "foo"})
      .then(assertCount(UserHistory,0))
      .then(function(user){
        user.name = "bar";
        return user.save();
      }).then(assertCount(UserHistory,1))
      .then(function(){
        return UserHistory.findAll();
      }).then(function(users){
        assert.equal(users.length,1, "only one entry in DB");
        assert.equal(users[0].name, "foo", "previous entry saved");
      }).then(function(user){
        return User.findOne();
      }).then(function(user){
        return user.destroy();
      }).then(assertCount(UserHistory,2))
    });
    it('onDelete: should store the previous version to the historyDB' , function(){
      return User.create({name: "foo"})
      .then(assertCount(UserHistory,0))
      .then(function(user){
        return user.destroy();
      }).then(assertCount(UserHistory,1))
      .then(function(){
        return UserHistory.findAll();
      }).then(function(users){
        assert.equal(users.length,1, "only one entry in DB");
        assert.equal(users[0].name, "foo", "previous entry saved");
      });
    });
  });

  describe('transactions', function(){
    beforeEach(freshDB);
    it('revert on failed transactions' , function(){
      return sequelize.transaction().then(function(t){
        var opts = {transaction: t};
        return User.create(opts)
        .then(assertCount(UserHistory,0, opts))
        .then(function(user){
          user.name = "foo";
          return user.save(opts);
        }).then(assertCount(UserHistory,1, opts))
        .then(function(){
          t.rollback();
        });
      }).then(assertCount(UserHistory,0));
    });
  });

  describe('bulk update', function(){
    beforeEach(freshDB);
    it('should archive every entry' , function(){
      return User.bulkCreate([
        {name: "foo1"},
        {name: "foo2"},
      ]).then(assertCount(UserHistory,0))
      .then(function(){
        return User.update({ name: 'updated-foo' }, {where: {}});
      }).then(assertCount(UserHistory,2))
    });
    it('should revert under transactions' , function(){
      return sequelize.transaction().then(function(t){
        var opts = {transaction: t};
        return User.bulkCreate([
          {name: "foo1"},
          {name: "foo2"},
        ], opts).then(assertCount(UserHistory,0,opts))
        .then(function(){
          return User.update({ name: 'updated-foo' }, {where: {}, transaction: t});
        }).then(assertCount(UserHistory,2, opts))
        .then(function(){
          t.rollback();
        });
      }).then(assertCount(UserHistory,0));
    });

  });

  describe('bulk destroy/truncate', function(){
    beforeEach(freshDB);
    it('should archive every entry' , function(){
      return User.bulkCreate([
        {name: "foo1"},
        {name: "foo2"},
      ]).then(assertCount(UserHistory,0))
      .then(function(){
        return User.destroy({
          where: {},
          truncate: true // truncate the entire table
        });
      }).then(assertCount(UserHistory,2))
    });
    it('should revert under transactions' , function(){
      return sequelize.transaction().then(function(t){
        var opts = {transaction: t};
        return User.bulkCreate([
          {name: "foo1"},
          {name: "foo2"},
        ], opts).then(assertCount(UserHistory,0,opts))
        .then(function(){
          return User.destroy({
            where: {},
            truncate: true, // truncate the entire table
            transaction: t
          });
        }).then(assertCount(UserHistory,2, opts))
        .then(function(){
          t.rollback();
        });
      }).then(assertCount(UserHistory,0));
    });


  });

  describe('read-only ', function(){
    it('should forbid updates' , function(){
      var userUpdate = UserHistory.create().then(function(uh){
        uh.update({name: 'bla'});
      });
      return assert.isRejected(userUpdate, Error, "Validation error");
    });
    it('should forbid deletes' , function(){
      var userUpdate = UserHistory.create().then(function(uh){
        uh.destroy();
      });
      return assert.isRejected(userUpdate, Error, "Validation error");
    });
  });

  describe('interference with the original model', function(){

    beforeEach(freshDB);

    it('shouldn\'t delete instance methods' , function(){
      Fruit = Temporal(sequelize.define('Fruit', {
        name: Sequelize.TEXT
      }), sequelize);
      Fruit.prototype.sayHi = function(){ return 2;}
      return sequelize.sync().then(function(){
        return Fruit.create();
      }).then(function(f){
        assert.isFunction(f.sayHi);
        assert.equal(f.sayHi(), 2);
      });
    });

    it('shouldn\'t interfere with hooks of the model' , function(){
      var triggered = 0;
      Fruit = Temporal(sequelize.define('Fruit', {
        name: Sequelize.TEXT
      }, {
        hooks:{
          beforeCreate: function(){ triggered++;}
        }
      }), sequelize);
      return sequelize.sync().then(function(){
        return Fruit.create();
      }).then(function(f){
        assert.equal(triggered, 1,"hook trigger count");
      });
    });

    it('shouldn\'t interfere with setters' , function(){
      var triggered = 0;
      Fruit = Temporal(sequelize.define('Fruit', {
        name: {
          type: Sequelize.TEXT,
          set: function(){
            triggered++;
          }
        }
      }), sequelize);
      return sequelize.sync().then(function(){
        return Fruit.create({name: "apple"});
      }).then(function(f){
        assert.equal(triggered, 1,"hook trigger count");
      });
    });

  });

  describe('full mode', function() {

    beforeEach(freshDBWithFullModeAndParanoid);

    it('onCreate: should store the new version in history db' , function(){
      return User.create({ name: 'test' })
        .then(function() {
          return UserHistory.findAll();
        })
        .then(function(histories) {
          assert.equal(1, histories.length);
          assert.equal('test', histories[0].name);
        });
    });

    it('onUpdate: should store the new version to the historyDB' , function(){
      return User.create({ name: 'test' })
        .then(function(user) {
          return user.update({ name: 'renamed' });
        })
        .then(function() {
          return UserHistory.findAll();
        })
        .then(function(histories) {
          assert.equal(histories.length, 2, 'two entries in DB');
          assert.equal(histories[0].name, 'test', 'first version saved');
          assert.equal(histories[1].name, 'renamed', 'second version saved');
        });
    });

    it('onDelete: should store the previous version to the historyDB' , function(){
      return User.create({ name: 'test' })
        .then(function(user) {
          return user.update({ name: 'renamed' });
        })
        .then(function(user) {
          return user.destroy();
        })
        .then(function() {
          return UserHistory.findAll();
        })
        .then(function(histories) {
          assert.equal(histories.length, 3, 'three entries in DB');
          assert.equal(histories[0].name, 'test', 'first version saved');
          assert.equal(histories[1].name, 'renamed', 'second version saved');
          assert.notEqual(histories[2].deletedAt, null, 'deleted version saved');
        });
    });

    it('onRestore: should store the new version to the historyDB' , function(){
      return User.create({ name: 'test' })
        .then(function(user) {
          return user.destroy();
        })
        .then(function(user) {
          return user.restore();
        })
        .then(function() {
          return UserHistory.findAll();
        })
        .then(function(histories) {
          assert.equal(histories.length, 3, 'three entries in DB');
          assert.equal(histories[0].name, 'test', 'first version saved');
          assert.notEqual(histories[1].deletedAt, null, 'deleted version saved');
          assert.equal(histories[2].deletedAt, null, 'restored version saved');
        });
    });

    it('should revert on failed transactions, even when using after hooks' , function(){
      return sequelize.transaction()
        .then(function(transaction) {
          var options = { transaction: transaction };

          return User.create({ name: 'test' }, options)
            .then(function(user) {
              return user.destroy(options);
            })
            .then(assertCount(UserHistory, 2, options))
            .then(function() {
              return transaction.rollback()
            });
        })
        .then(assertCount(UserHistory,0));
    });

  });

  describe('exclude fields option', function() {

    beforeEach(freshDBWithExcludedFields);

    it('onUpdate/onDestroy: shouldn\'t store excluded fields' , function(){
      return User.create()
      .then(assertCount(UserHistory,0))
      .then(function(user){
        user.name = "foo";
        return user.save();
      })
      .then(function() {
        return UserHistory.findAll();
      })
      .then(function(histories) {
        assertCount(UserHistory, 1)(histories)
        assert.equal(histories[0].fieldToExclude, null, 'fieldToExclude null')
      })
    });

  })

});

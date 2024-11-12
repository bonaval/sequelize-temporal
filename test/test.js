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
    return freshDBWithOptions();
  }

  function freshDBWithFullModeAndParanoid() {
    return freshDBWithOptions({ paranoid: true }, { full: true });
  }

  function freshDBWithOptions(modelOptions, temporalOptions){
    // overwrites the old SQLite DB
    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: __dirname + '/.test.sqlite',
      logging: process.env.LOGGING === 'true' ? console.log : false
    });
    User = Temporal(sequelize.define('User', {
      name: Sequelize.TEXT
    }, modelOptions), sequelize, temporalOptions);
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

    it('onUpdate: should store the previous version to the historyDB even if entity was partially loaded' , async function(){
      const created = await User.create({ name: 'name' });
      const user = await User.findByPk(created.id, { attributes: ['id', 'name'] }); // Don't fetch timestamps

      await user.update({ name: 'newName' });
      await user.update({ name: 'thirdName' });

      const history = await UserHistory.findAll();

      assert.equal(history.length, 3, 'initial revision and to updates saved');

      const [initial, firstUpdate, secondUpdate] = history;

      assert.equal(+initial.createdAt, +firstUpdate.createdAt, 'createdAt was saved during first update, despite not being eagerly loaded');
      assert.equal(+initial.createdAt, +secondUpdate.createdAt, 'createdAt was saved during second update, despite not being eagerly loaded');

      assert.isAtLeast(firstUpdate.updatedAt, initial.createdAt, 'updatedAt was saved during first update');
      assert.isAtLeast(secondUpdate.updatedAt, firstUpdate.updatedAt, 'updatedAt was saved during second update');

      assert.equal('name', initial.name);
      assert.equal('newName', firstUpdate.name);
      assert.equal('thirdName', secondUpdate.name);
    });

  });

  describe('silent mode', function(){

    it('onUpdate: should save to the historyDB if silent option is true but skipIfSilent is not set' , async function(){
      await freshDB();

      return User.create()
          .then(assertCount(UserHistory,0))
          .then(function(user){
            user.name = "foo";
            return user.save({ silent: true });
          }).then(assertCount(UserHistory,1))
          .then(function(user){
            return user.destroy();
          }).then(assertCount(UserHistory,2))
    });

    it('onUpdate: should not save to the historyDB if silent option is true and skipIfSilent is true' , async function(){
      await freshDBWithOptions(undefined, { skipIfSilent: true });

      return User.create()
          .then(assertCount(UserHistory,0))
          .then(function(user){
            user.name = "foo";
            return user.save({ silent: true });
          }).then(assertCount(UserHistory,0))
          .then(function(user){
            return user.destroy();
          }).then(assertCount(UserHistory,1))
    });

    it('bulkUpdate: should not save to the historyDB if silent is true and skipIfSilent is true' , async function(){
      await freshDBWithOptions(undefined, { skipIfSilent: true });

      return User.bulkCreate([
          {name: "foo1"},
          {name: "foo2"},
        ]).then(assertCount(UserHistory,0))
            .then(function(){
              return User.update({ name: 'updated-foo' }, { where: {}, silent: true });
            }).then(assertCount(UserHistory,0))
    });

  });

});

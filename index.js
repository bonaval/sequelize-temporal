var _ = require('lodash');

var temporalDefaultOptions = {
  // runs the insert within the sequelize hook chain, disable
  // for increased performance
  blocking: true,
  full: false,
  excludeFields: [],
};

var excludeAttributes = function(obj, attrsToExclude){
  // fancy way to exclude attributes
  return _.omit(obj, attrsToExclude);
}

var Temporal = function(model, sequelize, temporalOptions){
  temporalOptions = _.extend({},temporalDefaultOptions, temporalOptions);

  var Sequelize = sequelize.Sequelize;

  var historyName = model.name + 'History';
  //var historyName = model.getTableName() + 'History';
  //var historyName = model.options.name.singular + 'History';

  var historyOwnAttrs = {
    hid: {
      type:          Sequelize.BIGINT,
      primaryKey:    true,
      autoIncrement: true,
      unique: true
    },
    archivedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    }
  };

  var excludedAttributes = ["Model","unique","primaryKey","autoIncrement", "set", "get", "_modelAttribute"];

  var historyAttributes = _.reduce(_.keys(model.rawAttributes), function(acc, key) {
      var v = excludeAttributes(model.rawAttributes[key], excludedAttributes);
      // drop excluded fields
      if (
        temporalOptions.excludeFields.length && 
        temporalOptions.excludeFields.includes(v.fieldName)
      ) {
        return acc
      }

      // remove the "NOW" defaultValue for the default timestamps
      // we want to save them, but just a copy from our master record
      if(v.fieldName == "createdAt" || v.fieldName == "updatedAt"){
        v.type = Sequelize.DATE;
      }

      acc[key] = v
      return acc
    }, {})
  historyAttributes = _.assign({}, historyOwnAttrs, historyAttributes);

  var historyOwnOptions = {
    timestamps: false
  };
  var excludedNames = ["name", "tableName", "sequelize", "uniqueKeys", "hasPrimaryKey", "hooks", "scopes", "instanceMethods", "defaultScope"];
  var modelOptions = excludeAttributes(model.options, excludedNames);
  var historyOptions = _.assign({}, modelOptions, historyOwnOptions);

  // We want to delete indexes that have unique constraint
  var indexes = historyOptions.indexes;
  if(Array.isArray(indexes)){
     historyOptions.indexes = indexes.filter(function(index){return !index.unique && index.type != 'UNIQUE';});
  }

  var modelHistory = sequelize.define(historyName, historyAttributes, historyOptions);

  // we already get the updatedAt timestamp from our models
  var insertHook = function(obj, options){
    var dataValues = (!temporalOptions.full && obj._previousDataValues) || obj.dataValues;
    var historyRecord = modelHistory.create(dataValues, {transaction: options.transaction});
    if(temporalOptions.blocking){
      return historyRecord;
    }
  }
  var insertBulkHook = function(options){
    if(!options.individualHooks){
      var queryAll = model.findAll({where: options.where, transaction: options.transaction}).then(function(hits){
        if(hits){
          hits = _.map(hits, 'dataValues');
          return modelHistory.bulkCreate(hits, {transaction: options.transaction});
        }
      });
      if(temporalOptions.blocking){
        return queryAll;
      }
    }
  }

  // use `after` to be nonBlocking
  // all hooks just create a copy
  if (temporalOptions.full) {
    model.addHook('afterCreate', insertHook);
    model.addHook('afterUpdate', insertHook);
    model.addHook('afterDestroy', insertHook);
    model.addHook('afterRestore', insertHook);
  } else {
    model.addHook('beforeUpdate', insertHook);
    model.addHook('beforeDestroy', insertHook);
  }

  model.addHook('beforeBulkUpdate', insertBulkHook);
  model.addHook('beforeBulkDestroy', insertBulkHook);

  var readOnlyHook = function(){
    throw new Error("This is a read-only history database. You aren't allowed to modify it.");
  };

  modelHistory.addHook('beforeUpdate', readOnlyHook);
  modelHistory.addHook('beforeDestroy', readOnlyHook);

  return model;
};

module.exports = Temporal;

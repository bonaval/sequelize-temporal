var _ = require('lodash');

var temporalDefaultOptions = {
  // runs the insert within the sequelize hook chain, disable
  // for increased performance
  blocking: true,
  full: false,
  modelSuffix: 'History',
  addAssociations: false
};

var excludeAttributes = function(obj, attrsToExclude){
  // fancy way to exclude attributes
  return _.omit(obj, _.partial(_.rearg(_.contains,0,2,1), attrsToExclude));
}



var Temporal = function(model, sequelize, temporalOptions){
  temporalOptions = _.extend({},temporalDefaultOptions, temporalOptions);

  var Sequelize = sequelize.Sequelize;

  var historyName = model.name + temporalOptions.modelSuffix;

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
  var historyAttributes = _(model.rawAttributes).mapValues(function(v){	
    v = excludeAttributes(v, excludedAttributes);
    // remove the "NOW" defaultValue for the default timestamps
    // we want to save them, but just a copy from our master record
    if(v.fieldName == "createdAt" || v.fieldName == "updatedAt"){
      v.type = Sequelize.DATE;
    }
    return v;
  }).assign(historyOwnAttrs).value();
  // If the order matters, use this:
  //historyAttributes = _.assign({}, historyOwnAttrs, historyAttributes);

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

  var afterBulkSyncHook = function(options){		
	sequelize.removeHook('beforeBulkSync', 'TemporalBulkSyncHook');
	sequelize.removeHook('afterBulkSync', 'TemporalBulkSyncHook');
	return Promise.resolve('Temporal Hooks Removed');
  }
  

  var beforeBulkSyncHook = function(options){
	const customizer = function (objValue, srcValue, key, obj, src) {
		if(key == 'hid') 
			obj.primaryKey = false;
		else 
			obj.autoIncrement = false;
	
		return obj;
	}

	const allModels = sequelize.models;
	const mergePKs = _.partialRight(_.assignWith, customizer);

	Object.keys(allModels).forEach(key => {
		const source = allModels[key];	
		const sourceHistName = source.name + temporalOptions.modelSuffix;
		const sourceHist = allModels[sourceHistName];

		if(!source.name.endsWith(temporalOptions.modelSuffix) && source.associations && temporalOptions.addAssociations == true && sourceHist) {
			const pkfield = source.primaryKeyField;
			//adding associations from historical model to origin model's association
			Object.keys(source.associations).forEach(key => {			
				const association = source.associations[key];				
				const target = association.target;
				const assocName = association.associationType.charAt(0).toLowerCase() + association.associationType.substr(1);				

				//handle premary keys for belongsToMany
				if(assocName == 'belongsToMany') {									
					sourceHist.primaryKeys = mergePKs({}, sourceHist.primaryKeys, source.primaryKeys);
					sourceHist.primaryKeys.hid.primaryKey = false;
					sourceHist.primaryKeys[pkfield].autoIncrement = false;
				}

				sourceHist[assocName].apply(sourceHist, [target, association.options]);

				//TODO test with several associations to the same table i.e: addedBy, UpdatedBy
			});

			//adding associations between origin model and historical					
			source.hasMany(sourceHist, { foreignKey: pkfield });
			sourceHist.belongsTo(source, { foreignKey: pkfield });	
			
			sequelize.models[sourceHistName] = sourceHist;	
			sequelize.models[sourceHistName].sync();
		}		
	}); 

	return Promise.resolve('Temporal associations established');
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

  sequelize.removeHook('beforeBulkSync', 'TemporalBulkSyncHook');//remove first to avoid duplicating
  sequelize.removeHook('afterBulkSync', 'TemporalBulkSyncHook');//remove first to avoid duplicating  
  sequelize.addHook('afterBulkSync', 'TemporalBulkSyncHook', afterBulkSyncHook);	
  sequelize.addHook('beforeBulkSync', 'TemporalBulkSyncHook', beforeBulkSyncHook);	

  modelHistory.addAssociations = temporalOptions.addAssociations;  
  return model;
};

module.exports = Temporal;

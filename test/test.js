const Record = require('../');
const Sequelize = require('sequelize');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const fs = require('fs');
chai.use(chaiAsPromised);
const assert = chai.assert;
const eventually = assert.eventually;

describe('Read-only API', function(){
  	var sequelize;
  
	function newDB(paranoid, options){
		if(sequelize) {
			sequelize.close();
			sequelize = null;
		}	

		const dbFile = __dirname + '/.test.sqlite';
		try {fs.unlinkSync(dbFile);} catch {};

		sequelize = new Sequelize('', '', '', {
			dialect: 'sqlite',
			storage: dbFile,
			logging: false//console.log
		});	

		//Define origin models
		const User = sequelize.define('User', { name: Sequelize.TEXT }, {paranoid: paranoid || false});
		const Creation = sequelize.define('Creation', { name: Sequelize.TEXT, user: Sequelize.INTEGER, user2: Sequelize.INTEGER }, {paranoid: paranoid || false});	
		const Tag = sequelize.define('Tag', { name: Sequelize.TEXT }, {paranoid: paranoid || false});	
		const Event = sequelize.define('Event', { name: Sequelize.TEXT, creation: Sequelize.INTEGER }, {paranoid: paranoid || false});	
		const CreationTag = sequelize.define('CreationTag', { creation: Sequelize.INTEGER, tag: Sequelize.INTEGER }, {paranoid: paranoid || false});

		//Associate models	

		//1.* with 2 association to same table
		User.hasMany(Creation, { foreignKey: 'user', as: 'creatorCreations' });
		User.hasMany(Creation, { foreignKey: 'user2', as: 'updatorCreations' });
			
		Creation.belongsTo(User, { foreignKey: 'user', as: 'createUser' });	
		Creation.belongsTo(User, { foreignKey: 'user2', as: 'updateUser' });	

		//1.1
		Event.belongsTo(Creation, { foreignKey: 'creation' });
		Creation.hasOne(Event, { foreignKey: 'creation' });
		
		//*.*
		Tag.belongsToMany(Creation, { through: CreationTag, foreignKey: 'tag', otherKey: 'creation' });
		Creation.belongsToMany(Tag, { through: CreationTag, foreignKey: 'creation', otherKey: 'tag' });

		//Recordize
		Record(User, sequelize, options);
		Record(Creation, sequelize, options);  
		Record(Tag, sequelize, options);
		Record(Event, sequelize, options);
		Record(CreationTag, sequelize, options);

		return sequelize.sync({force:true});
	}

	//Adding 3 tags, 2 creations, 2 events, 2 user
	//each creation has 3 tags
	//user has 2 creations
	//creation has 1 event
	//tags,crestions,user,events are renamed 3 times to generate 3 record data
	//1 tag is removed and re-added to a creation to create 1 record entry in the CreationTags table
	function dataCreate()
	{
		const tag = sequelize.models.Tag.create({ name: 'tag01' }).then( t => {
			t.name = 'tag01 renamed';
			t.save();	
			t.name = 'tag01 renamed twice';
			t.save();			
			t.name = 'tag01 renamed three times';
			t.save();		
			return t;						
		});

		const tag2 = sequelize.models.Tag.create({ name: 'tag02' }).then( t => {
			t.name = 'tag02 renamed';
			t.save();	
			t.name = 'tag02 renamed twice';
			t.save();			
			t.name = 'tag02 renamed three times';
			t.save();		
			return t;						
		});

		const tag3 = sequelize.models.Tag.create({ name: 'tag03' }).then( t => {
			t.name = 'tag03 renamed';
			t.save();	
			t.name = 'tag03 renamed twice';
			t.save();			
			t.name = 'tag03 renamed three times';
			t.save();		
			return t;						
		});

		const user = sequelize.models.User.create({ name: 'user01' }).then( u => {
			u.name = 'user01 renamed';		
			u.save();						
			u.name = 'user01 renamed twice';
			u.save();			
			u.name = 'user01 renamed three times';
			u.save();
			return u;		
		});

		const user2 = sequelize.models.User.create({ name: 'user02' }).then( u => {
			u.name = 'user02 renamed';		
			u.save();						
			u.name = 'user02 renamed twice';
			u.save();			
			u.name = 'user02 renamed three times';
			u.save();
			return u;		
		});
		
		const creation = Promise.all([user, user2])
			.then(allU => sequelize.models.Creation.create({ name: 'creation01', user: allU[0].id, user2: allU[1].id }))
			.then( c => {
			c.name = 'creation01 renamed';
			c.save();	
			c.name = 'creation01 renamed twice';
			c.save();			
			c.name = 'creation01 renamed three times';
			c.save();		
			return c;						
		});

		const creation2 = Promise.all([user, user2])
			.then(allU => sequelize.models.Creation.create({ name: 'creation02', user: allU[0].id, user2: allU[1].id }))
			.then( c => {
			c.name = 'creation02 renamed';
			c.save();	
			c.name = 'creation02 renamed twice';
			c.save();			
			c.name = 'creation02 renamed three times';
			c.save();		
			return c;						
		});

		const event = creation.then(c => sequelize.models.Event.create({ name: 'event01', creation: c.id }))
			.then( e => {
			e.name = 'event01 renamed';
			e.save();	
			e.name = 'event01 renamed twice';
			e.save();			
			e.name = 'event01 renamed three times';
			e.save();		
			return e;						
		});

		const event2 = creation2.then(c => sequelize.models.Event.create({ name: 'event02', creation: c.id }))
			.then( e => {
			e.name = 'event02 renamed';
			e.save();	
			e.name = 'event02 renamed twice';
			e.save();			
			e.name = 'event02 renamed three times';
			e.save();		
			return e;						
		});

		const creationTag1 =  Promise.all([tag, creation]).then(models =>{
			const t = models[0];
			const c = models[1];

			return c.addTag(t);
		});

		const creationTag1_rem =  Promise.all([tag, creation,creationTag1]).then(models =>{
			const t = models[0];
			const c = models[1];

			return c.removeTag(t);
		});

		const creationTag1_rea =  Promise.all([tag, creation,creationTag1_rem]).then(models =>{
			const t = models[0];
			const c = models[1];

			return c.addTag(t);
		});

		const creationTag2 =  Promise.all([tag2, creation]).then(models =>{
			const t = models[0];
			const c = models[1];

			return c.addTag(t);
		});

		const creationTag3 =  Promise.all([tag3, creation]).then(models =>{
			const t = models[0];
			const c = models[1];

			return c.addTag(t);
		});

		const creationTag4 =  Promise.all([tag, creation2]).then(models =>{
			const t = models[0];
			const c = models[1];

			return c.addTag(t);
		});

		const creationTag5 =  Promise.all([tag2, creation2]).then(models =>{
			const t = models[0];
			const c = models[1];

			return c.addTag(t);
		});

		const creationTag6 =  Promise.all([tag3, creation2]).then(models =>{
			const t = models[0];
			const c = models[1];

			return c.addTag(t);
		});

		return Promise.all([
			event, 
			event2, 
			tag, 
			tag2, 
			tag3, 
			user, 
			user2,
			creation, 
			creation2,
			creationTag1,
			creationTag2,
			creationTag3,
			creationTag4,
			creationTag5,
			creationTag6,
			creationTag1_rea,
			creationTag1_rem
		]);
	}

	function freshDB(){
		return newDB();
	}

	function freshDBWithAssociations(){
		return newDB(false,  { addAssociations: true});
	}

	function freshDBWithFullModeAndParanoid(){
		return newDB(true,{ full: true });
	}

	function freshDBWithSuffixEndingWithT(){
		return newDB(false,  { modelSuffix: '_Hist'});
	}

	function assertCount(modelRecord, n, opts) {
		// wrapped, chainable promise
		return function(obj) {
			return modelRecord.count(opts).then((count) => {
				//console.log('Asserting ', modelRecord.name, ' count: ', count, ' expected: ', n);
				assert.equal(n, count, "record entries")
				return obj;
			});
		}
	}

	describe('Association Tests', function() {
		describe('test there are no record association', function(){
			beforeEach(freshDB);
			it('Should have relations for origin models but not for record models' , function(){
				const init = dataCreate();
				
				//Get User
				const user = init.then(() => sequelize.models.User.findOne());

				//User associations check
				const userRecord = user.then(u =>{					
					assert.notExists(u.getUserRecords, 'User: getUserRecords exists');					
					return Promise.resolve('done');
				});

				const creation = user.then(u =>{
					assert.exists(u.getCreatorCreations, 'User: getCreatorCreations does not exist');
					assert.exists(u.getUpdatorCreations, 'User: getUpdatorCreations does not exist');
					return u.getCreatorCreations();
				});				

				//Creation associations check
				const creationRecord = creation.then(c =>{
					assert.equal(c.length, 2, 'User: should have found 2 creations');
					const first = c[0];
					assert.notExists(first.getCreationRecords, 'Creation: getCreationRecords exists');			
					return Promise.resolve('done');
				});

				const tag = creation.then(c =>{		
					const first = c[0];
					assert.exists(first.getTags, 'Creation: getTags does not exist');				
					return first.getTags();
				});

				const event = creation.then(c =>{		
					const first = c[0];
					assert.exists(first.getEvent, 'Creation: getEvent does not exist');
					return first.getEvent();
				});

				const cUser = creation.then(c =>{		
					const first = c[0];
					assert.exists(first.getCreateUser, 'Creation: getCreateUser does not exist');	
					assert.exists(first.getUpdateUser, 'Creation: getUpdateUser does not exist');
					return first.getCreateUser();
				}).then(cu => {
					assert.exists(cu, 'Creation: did not find CreateUser');
					return Promise.resolve('done');
				});				

				//Tag associations check
				const tagRecord = tag.then(t =>{					
					assert.equal(t.length, 3, 'Creation: should have found 3 tags');
					const first = t[0];
					assert.notExists(first.getTagRecords, 'Tag: getTagRecords exists');
					return Promise.resolve('done');
				});

				const tCreation = tag.then(t =>{		
					const first = t[0];					
					assert.exists(first.getCreations, 'Tag: getCreations does not exist');
					return first.getCreations();
				}).then(tc => {
					assert.equal(tc.length, 2, 'Tag: should have found 2 creations');					
					return Promise.resolve('done');
				});
			
				//Event associations check
				const eventRecord = event.then(e =>{			
					assert.exists(e, 'Creation: did not find event');
					assert.notExists(e.getEventRecords, 'Event: getEventRecords exist');
					return Promise.resolve('done');
				});

				const eCreation = event.then(e =>{					
					assert.exists(e.getCreation);
					return e.getCreation();
				}).then(ec => {
					assert.exists(ec);
					return Promise.resolve('done');
				});	

				//Check record data
				const userRecords = init.then(assertCount(sequelize.models.UserRecord, 6));
				const creationRecords = init.then(assertCount(sequelize.models.CreationRecord, 6));
				const tagRecords = init.then(assertCount(sequelize.models.TagRecord, 9));
				const eventRecords = init.then(assertCount(sequelize.models.EventRecord, 6));
				const creationTagRecords = init.then(assertCount(sequelize.models.CreationTagRecord, 1));

				return Promise.all([
					creation,
					creationRecords,
					creationRecord,
					creationTagRecords,
					cUser,
					eCreation,
					event,
					eventRecords,
					eventRecord,
					init,
					tag,
					tagRecords,
					tagRecord,
					tCreation,
					user,
					userRecords,
					userRecord
				]);	
			});
		});

		describe('test there are associations are created between origin and record', function(){
			beforeEach(freshDBWithAssociations);
			it('Should have relations for origin models and for record models to origin' , function(){
				const init = dataCreate();
				
				//Get User
				const user = init.then(() => sequelize.models.User.findOne());

				//User associations check
				const userRecord = user.then(u =>{
					assert.exists(u.getUserRecords, 'User: getUserRecords does not exist');					
					return u.getUserRecords();
				});

				const creation = user.then(u =>{
					assert.exists(u.getCreatorCreations, 'User: getCreatorCreations does not exist');
					assert.exists(u.getUpdatorCreations, 'User: getUpdatorCreations does not exist');
					return u.getCreatorCreations();
				});

				//UserRecords associations check
				const uhCreation = userRecord.then(uh =>{
					assert.equal(uh.length, 3, 'User: should have found 3 UserRecords');
					const first = uh[0];
					assert.exists(first.getCreatorCreations, 'UserRecord: getCreatorCreations does not exist');					
					assert.exists(first.getUpdatorCreations, 'UserRecord: getUpdatorCreations does not exist');
					return first.getCreatorCreations();
				}).then(uhc => {
					assert.equal(uhc.length, 2, 'UserRecord: should have found 2 creations');
					return Promise.resolve('done');
				});

				const uhUser = userRecord.then(uh =>{
					const first = uh[0];
					assert.exists(first.getUser, 'UserRecord: getUser does not exist');
					return first.getUser();
				}).then(uhu => {
					assert.exists(uhu, 'UserRecord: did not find a user');
					return Promise.resolve('done');
				});

				//Creation associations check
				const creationRecord = creation.then(c =>{
					assert.equal(c.length, 2, 'User: should have found 2 creations');
					const first = c[0];
					assert.exists(first.getCreationRecords, 'Creation: getCreationRecords does not exist');			
					return first.getCreationRecords();
				});

				const tag = creation.then(c =>{		
					const first = c[0];
					assert.exists(first.getTags, 'Creation: getTags does not exist');				
					return first.getTags();
				});

				const event = creation.then(c =>{		
					const first = c[0];
					assert.exists(first.getEvent, 'Creation: getEvent does not exist');
					return first.getEvent();
				});

				const cUser = creation.then(c =>{		
					const first = c[0];
					assert.exists(first.getCreateUser, 'Creation: getCreateUser does not exist');	
					assert.exists(first.getUpdateUser, 'Creation: getUpdateUser does not exist');	
					return first.getCreateUser();
				}).then(cu => {
					assert.exists(cu, 'Creation: did not find a create user');
					return Promise.resolve('done');
				});

				//CreationRecords association check
				const chCreation = creationRecord.then(ch =>{					
					assert.equal(ch.length, 3, 'Creation: should have found 3 CreationRecords');
					const first = ch[0];
					assert.exists(first.getCreation, 'CreationRecord: getCreation does not exist');				
					return first.getCreation();
				}).then(chc => {
					assert.exists(chc, 'CreationRecord: did noy find a creation');
					return Promise.resolve('done');
				});

				const chTag = creationRecord.then(ch =>{
					const first = ch[0];
					assert.exists(first.getTags, 'CreationRecord: getTags does not exist');
					return first.getTags();
				}).then(uht => {
					assert.equal(uht.length, 3);
					return Promise.resolve('done');
				});

				const chUser = creationRecord.then(ch =>{
					const first = ch[0];
					assert.exists(first.getCreateUser, 'CreationRecord: getCreateUser does not exist');
					assert.exists(first.getUpdateUser, 'CreationRecord: getUpdateUser does not exist');
					return first.getCreateUser();
				}).then(chu => {
					assert.exists(chu, 'CreationRecord: did not find a user');
					return Promise.resolve('done');
				});

				const chEvent = creationRecord.then(ch =>{
					const first = ch[0];
					assert.exists(first.getEvent, 'CreationRecord: getEvent does not exist');
					return first.getEvent();
				}).then(che => {
					assert.exists(che, 'CreationRecord: did not find an event');
					return Promise.resolve('done');
				});


				//Tag associations check
				const tagRecord = tag.then(t =>{					
					assert.equal(t.length, 3, 'Creation: should have found 3 tags');
					const first = t[0];
					assert.exists(first.getTagRecords, 'Tag: getTagRecords does not exist');
					return first.getTagRecords();
				});

				const tCreation = tag.then(t =>{		
					const first = t[0];					
					assert.exists(first.getCreations, 'Tag: getCreations does not exist');
					return first.getCreations();
				}).then(tc => {
					assert.equal(tc.length, 2, 'Tag: should have found 2 creations');					
					return Promise.resolve('done');
				});

				//TagRecords associations check
				const thTag = tagRecord.then(th =>{
					assert.equal(th.length, 3, 'TagRecord: should have found 3 TagRecords');
					const first = th[0];
					assert.exists(first.getTag, 'TagRecord: getTag does not exist');
					return first.getTag();
				}).then(tht => {
					assert.exists(tht, 'TagRecord: did not find a tag');
					return Promise.resolve('done');
				});

				const thCreation = tagRecord.then(th =>{	
					const first = th[0];
					assert.exists(first.getCreations, 'TagRecord: getCreations does not exist');
					return first.getCreations();
				}).then(thc => {
					assert.equal(thc.length, 2, 'TagRecord: should have found 2 creations');
					return Promise.resolve('done');
				});

				//Event associations check
				const eventRecord = event.then(e =>{			
					assert.exists(e, 'Creation: did not find an event');
					assert.exists(e.getEventRecords, 'Event: getEventRecords does not exist');
					return e.getEventRecords();
				});

				const eCreation = event.then(e =>{					
					assert.exists(e.getCreation, 'Event: getCreation does not exist');
					return e.getCreation();
				}).then(ec => {
					assert.exists(ec, 'Event: did not find a creation');
					return Promise.resolve('done');
				});	

				//EventRecords associations check
				const ehEvent = eventRecord.then(eh =>{
					assert.equal(eh.length, 3, 'Event: should have found 3 EventRecords');					
					const first = eh[0];	
					assert.exists(first.getEvent, 'EventRecords: getEvent does not exist');				
					return first.getEvent();
				}).then(ehe => {
					assert.exists(ehe, 'EventRecords: did not find an event');
					return Promise.resolve('done');
				});	

				const ehCreation = eventRecord.then(eh =>{		
					const first = eh[0];
					assert.exists(first.getCreation, 'EventRecords: getCreation does not exist');
					return first.getCreation();
				}).then(ehc => {
					assert.exists(ehc, 'EventRecords: did not find a creation');
					return Promise.resolve('done');
				});	
				
				//Check record data
				const userRecords = init.then(assertCount(sequelize.models.UserRecord, 6));
				const creationRecords = init.then(assertCount(sequelize.models.CreationRecord, 6));
				const tagRecords = init.then(assertCount(sequelize.models.TagRecord, 9));
				const eventRecords = init.then(assertCount(sequelize.models.EventRecord, 6));
				const creationTagRecords = init.then(assertCount(sequelize.models.CreationTagRecord, 1));


				return Promise.all([
					chCreation,
					chEvent,
					chTag,
					chUser,
					creation,
					creationRecords,
					creationRecord,
					creationTagRecords,
					cUser,
					eCreation,
					event,
					eventRecords,
					eventRecord,
					init,
					tag,
					tagRecords,
					tagRecord,
					tCreation,
					thCreation,
					thTag,
					uhCreation,
					uhUser,
					user,
					userRecords,
					userRecord,
					ehEvent,
					ehCreation
				]);	
			});
		});		
	});

	//these tests are the same as hooks since the results should not change, even with a different model name
	//Only added is to test for the model name
	describe('test suffix ending in T', function() {
		beforeEach(freshDBWithSuffixEndingWithT);
		it('onCreate: should not store the new version in record db' , function() {			
			return sequelize.models.User.create({ name: 'test' })
				.then(assertCount(sequelize.models.User_Hist, 0));
		});
		it('onUpdate/onDestroy: should save to the recordDB' , function() {
			return sequelize.models.User.create()
				.then(assertCount(sequelize.models.User_Hist,0))
				.then((user) => {
					user.name = "foo";
					return user.save();
				})
				.then(assertCount(sequelize.models.User_Hist,1))
				.then(user => user.destroy())
				.then(assertCount(sequelize.models.User_Hist,2));
		});
		it('onUpdate: should store the previous version to the recordDB' , function() {
			return sequelize.models.User.create({name: "foo"})
				.then(assertCount(sequelize.models.User_Hist,0))
				.then((user) => {
					user.name = "bar";
					return user.save();
				})
				.then(assertCount(sequelize.models.User_Hist,1))
				.then(() => sequelize.models.User_Hist.findAll())
				.then((users) => {
					assert.equal(users.length,1, "only one entry in DB");
					assert.equal(users[0].name, "foo", "previous entry saved");
				})
				.then(() => sequelize.models.User.findOne())
				.then((user) => user.destroy())
				.then(assertCount(sequelize.models.User_Hist,2))
		});
		it('onDelete: should store the previous version to the recordDB' , function() {
			return sequelize.models.User.create({name: "foo"})
				.then(assertCount(sequelize.models.User_Hist,0))
				.then(user => user.destroy())
				.then(assertCount(sequelize.models.User_Hist,1))
				.then(() => sequelize.models.User_Hist.findAll())
				.then((users) => {
					assert.equal(users.length,1, "only one entry in DB");
					assert.equal(users[0].name, "foo", "previous entry saved");
				});
		});
	});

	describe('hooks', function() {
		beforeEach(freshDB);
		it('onCreate: should not store the new version in record db' , function() {
			return sequelize.models.User.create({ name: 'test' })
				.then(assertCount(sequelize.models.UserRecord, 0));
		});
		it('onUpdate/onDestroy: should save to the recordDB' , function() {
			return sequelize.models.User.create()
				.then(assertCount(sequelize.models.UserRecord,0))
				.then((user) => {
					user.name = "foo";
					return user.save();
				})
				.then(assertCount(sequelize.models.UserRecord,1))
				.then(user => user.destroy())
				.then(assertCount(sequelize.models.UserRecord,2))
		});
		it('onUpdate: should store the previous version to the recordDB' , function() {
			return sequelize.models.User.create({name: "foo"})
				.then(assertCount(sequelize.models.UserRecord,0))
				.then((user) => {
					user.name = "bar";
					return user.save();
				})
				.then(assertCount(sequelize.models.UserRecord,1))
				.then(() => sequelize.models.UserRecord.findAll())
				.then((users) => {
					assert.equal(users.length,1, "only one entry in DB");
					assert.equal(users[0].name, "foo", "previous entry saved");
				}).then(user => sequelize.models.User.findOne())
				.then(user => user.destroy())
				.then(assertCount(sequelize.models.UserRecord,2))
		});
		it('onDelete: should store the previous version to the recordDB' , function() {
			return sequelize.models.User.create({name: "foo"})
				.then(assertCount(sequelize.models.UserRecord,0))
				.then(user => user.destroy())
				.then(assertCount(sequelize.models.UserRecord,1))
				.then(() => sequelize.models.UserRecord.findAll())
				.then((users) => {
					assert.equal(users.length,1, "only one entry in DB");
					assert.equal(users[0].name, "foo", "previous entry saved");
				});
		});
	});

	describe('transactions', function() {
		beforeEach(freshDB);
		it('revert on failed transactions' , function() {
			return sequelize.transaction()
				.then((t) => {
					var opts = {transaction: t};
					return sequelize.models.User.create({name: "not foo"},opts)
						.then(assertCount(sequelize.models.UserRecord,0, opts))
						.then((user) => {							
							user.name = "foo";
							user.save(opts);
						})
						.then(assertCount(sequelize.models.UserRecord,1, opts))
						.then(() => t.rollback());
				})
				.then(assertCount(sequelize.models.UserRecord,0));
		});
	});

	describe('bulk update', function() {
		beforeEach(freshDB);
		it('should archive every entry', function() {
			return sequelize.models.User.bulkCreate([{name: "foo1"},{name: "foo2"}])
				.then(assertCount(sequelize.models.UserRecord,0))
				.then(() => sequelize.models.User.update({ name: 'updated-foo' }, {where: {}}))
				.then(assertCount(sequelize.models.UserRecord,2))
		});
		it('should revert under transactions', function() {
			return sequelize.transaction()
				.then(function(t) {
					var opts = {transaction: t};
					return sequelize.models.User.bulkCreate([{name: "foo1"},{name: "foo2"}], opts)
						.then(assertCount(sequelize.models.UserRecord,0,opts))
						.then(() => sequelize.models.User.update({ name: 'updated-foo' }, {where: {}, transaction: t}))
						.then(assertCount(sequelize.models.UserRecord,2, opts))
						.then(() => t.rollback());
				})
				.then(assertCount(sequelize.models.UserRecord,0));
		});
	});

	describe('bulk destroy/truncate', function() {
		beforeEach(freshDB);
		it('should archive every entry', function() {
			return sequelize.models.User.bulkCreate([{name: "foo1"},{name: "foo2"}])
				.then(assertCount(sequelize.models.UserRecord,0))
				.then(() =>  sequelize.models.User.destroy({
					where: {},
					truncate: true // truncate the entire table
				}))
				.then(assertCount(sequelize.models.UserRecord,2))
		});
		it('should revert under transactions', function() {
			return sequelize.transaction()
				.then((t) => {
					var opts = {transaction: t};
					return sequelize.models.User.bulkCreate([{name: "foo1"},{name: "foo2"}], opts)
						.then(assertCount(sequelize.models.UserRecord,0,opts))
						.then(() => sequelize.models.User.destroy({
							where: {},
							truncate: true, // truncate the entire table
							transaction: t
						}))
						.then(assertCount(sequelize.models.UserRecord,2, opts))
						.then(() => t.rollback());
				})
				.then(assertCount(sequelize.models.UserRecord,0));
		});
  	});

	describe('bulk destroy/truncate with associations', function() {
		beforeEach(freshDBWithAssociations);
		it('should archive every entry', function() {
			return dataCreate()
			.then(assertCount(sequelize.models.UserRecord,3))
			.then(() => sequelize.models.User.destroy({
				where: {},
				truncate: true // truncate the entire table
			}))
			.then(assertCount(sequelize.models.UserRecord,6))
			.then(() => sequelize.models.User.findOne())
			.then(u => u.getUserRecords())
			.then(uh => assert.exists(uh, 'The truncation did not break the associations'))
			.catch(err => assert.exists(err,'The truncation broke the associations'));
		});
		it('should fail to truncate', function() {
			return dataCreate()
				.then(() => sequelize.transaction())
				.then((t) => {
					var opts = {transaction: t};
					assertCount(sequelize.models.UserRecord,6,opts);
					return sequelize.models.User.destroy({
						where: {},
						truncate: true, // truncate the entire table
						transaction: t
					})
					.then(assertCount(sequelize.models.UserRecord,3,opts))
					.then(() => t.rollback())
					.catch(err => assert.exists(err));
				})
				.then(assertCount(sequelize.models.UserRecord,6));
		});
	});
	  
	describe('read-only ', function() {
		beforeEach(freshDB);
		it('should forbid updates' , function() {			
			var userUpdate = sequelize.models.UserRecord.create({name: 'bla00'})
				.then((uh) => uh.update({name: 'bla'}));

			return assert.isRejected(userUpdate, Error, "Validation error");
		});
		it('should forbid deletes' , function() {
			var userUpdate = sequelize.models.UserRecord.create({name: 'bla00'})
				.then(uh  => uh.destroy());

			return assert.isRejected(userUpdate, Error, "Validation error");
		});
	});

	describe('interference with the original model', function() {
		beforeEach(freshDB);
		it('shouldn\'t delete instance methods' , function() {
			Fruit = Record(sequelize.define('Fruit', { name: Sequelize.TEXT }), sequelize);
			Fruit.prototype.sayHi = () => { return 2; }

			return sequelize.sync()
				.then(() => Fruit.create())
				.then((f) => {
					assert.isFunction(f.sayHi);
					assert.equal(f.sayHi(), 2);
				});
		});

		it('shouldn\'t interfere with hooks of the model' , function() {
			var triggered = 0;
			Fruit = Record(sequelize.define('Fruit', { name: Sequelize.TEXT }, { hooks:{ beforeCreate: function(){ triggered++; }}}), sequelize);
			return sequelize.sync()
				.then(() => Fruit.create())
				.then((f) =>  assert.equal(triggered, 1,"hook trigger count"));
		});

		it('shouldn\'t interfere with setters' , function() {
			var triggered = 0;
			Fruit = Record(sequelize.define('Fruit', {
				name: {
					type: Sequelize.TEXT,
					set: function() { triggered++; }
				}
			}), sequelize);
			return sequelize.sync()
				.then(() => Fruit.create({name: "apple"}))
				.then((f)  => assert.equal(triggered, 1,"hook trigger count"));
		});
	});

	describe('full mode', function() {
		beforeEach(freshDBWithFullModeAndParanoid);
		it('onCreate: should store the new version in record db' , function() {
			return sequelize.models.User.create({ name: 'test' })
				.then(() => sequelize.models.UserRecord.findAll())
				.then((records) => {
					assert.equal(1, records.length);
					assert.equal('test', records[0].name);
				});
		});

		it('onUpdate: should store the new version to the recordDB' , function() {
			return sequelize.models.User.create({ name: 'test' })
				.then(user => user.update({ name: 'renamed' }))
				.then(() => sequelize.models.UserRecord.findAll())
				.then((records) => {
					assert.equal(records.length, 2, 'two entries in DB');
					assert.equal(records[0].name, 'test', 'first version saved');
					assert.equal(records[1].name, 'renamed', 'second version saved');
				});
		});

		it('onDelete: should store the previous version to the recordDB' , function() {
			return sequelize.models.User.create({ name: 'test' })
				.then(user => user.update({ name: 'renamed' }))
				.then(user=> user.destroy())
				.then(() => sequelize.models.UserRecord.findAll())
				.then((records) => {
					assert.equal(records.length, 3, 'three entries in DB');
					assert.equal(records[0].name, 'test', 'first version saved');
					assert.equal(records[1].name, 'renamed', 'second version saved');
					assert.notEqual(records[2].deletedAt, null, 'deleted version saved');
				});
		});

		it('onRestore: should store the new version to the recordDB' , function() {
			return sequelize.models.User.create({ name: 'test' })
				.then(user => user.destroy())
				.then(user => user.restore())
				.then(() => sequelize.models.UserRecord.findAll())
				.then((records) => {
					assert.equal(records.length, 3, 'three entries in DB');
					assert.equal(records[0].name, 'test', 'first version saved');
					assert.notEqual(records[1].deletedAt, null, 'deleted version saved');
					assert.equal(records[2].deletedAt, null, 'restored version saved');
				});
		});

		it('should revert on failed transactions, even when using after hooks' , function(){
			return sequelize.transaction()
				.then((transaction) => {
					var options = { transaction: transaction };

					return sequelize.models.User.create({ name: 'test' }, options)
						.then(user => user.destroy(options))
						.then(assertCount(sequelize.models.UserRecord, 2, options))
						.then(() => transaction.rollback());
				})
				.then(assertCount(sequelize.models.UserRecord,0));
		});
	});  
});

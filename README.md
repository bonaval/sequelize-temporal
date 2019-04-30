Record tables for Sequelize
===============================

Warning: this is a fork of [sequelize-temporal](https://github.com/bonaval/sequelize-temporal) that adds the ability to associate data history table to origin tables (table a record is based on) and to specify a different name for the __Record__ tables.

[![Build Status](https://travis-ci.org/kurisutofu/sequelize-record.svg?branch=master)](https://travis-ci.org/kurisutofu/sequelize-record) [![Dependency Status](https://david-dm.org/kurisutofu/sequelize-record.svg)](https://david-dm.org/kurisutofu/sequelize-record) [![NPM version](https://img.shields.io/npm/v/sequelize-record.svg)](https://www.npmjs.com/package/sequelize-record) [![Greenkeeper badge](https://badges.greenkeeper.io/kurisutofu/sequelize-record.svg)](https://greenkeeper.io/)


What is it?
-----------

___Record__ tables maintain __previous values__ of data. Modifying operations (UPDATE, DELETE) on these tables don't cause permanent changes to entries, but create new versions of them. Hence this might be used to:

- log changes (security/auditing)
- undo functionalities
- track interactions (customer support)

Under the hood a record table with the same structure, but without constraints is created (unless option __addAssociation__ is set to __true__).

The normal singular/plural naming scheme in Sequelize is used:

- model name: `modelName + Record`
- table name: `modelName + Records`

Installation
------------

```
npm install sequelize-record
```

How to use
----------

### 1) Import `sequelize-record`

```
var Sequelize = require('sequelize');
var Record = require('sequelize-record');
```

Create a sequelize instance and your models, e.g.

```
var sequelize = new Sequelize('', '', '', {
	dialect: 'sqlite',
	storage: __dirname + '/.test.sqlite'
});
```

### 2) Add the *record* feature to your models

```
var User = Record(sequelize.define('User'), sequelize);
```

The output of `Record` is its input model, so assigning it's output to your
Model is not necessary, hence it's just the lazy version of:

```
var User = sequelize.define('User', {.types.}, {.options.}); //Vanilla Sequelize
Record(User, sequelize);
```

Options
-------

The default syntax for `Record` is:

`Record(model, sequelizeInstance, options)`

whereas the options are listed here (with default value).

```js
{
  /* 
  Runs the insert within the sequelize hook chain, disable
  for increased performance without warranties */
  blocking: true,
  /* 
  By default sequelize-record persist only changes, and saves the previous state in the record table.
  The "full" option saves all transactions into the record database
  (i.e. this includes the latest state.)
   This allows to only query the record table to get the full record of an entity.
  */
  full: false,
  /* 
  By default sequelize-record will add 'Record' to the record Model name and 'Records' to the record table.
  By updating the modelSuffix value, you can decide what the naming will be.
  The value will be appended to the record Model name and its plural will be appended to the record tablename.

  examples for table User:
	modelSuffix: '_Hist'  --> Record Model Name: User_Hist  --> Record Table Name: User_Hists  
	modelSuffix: 'Memory'  --> Record Model Name: UserMemory  --> Record Table Name: UserMemories
	modelSuffix: 'Pass'  --> Record Model Name: UserPass  --> Record Table Name: UserPasses
  */
  modelSuffix: 'Record',
  /* 
  By default sequelize-record will create the record table without associations.
  However, setting this flag to true, you can keep association between the record table and the table with the latest value (origin).

  example for table User:
	  model: 'User'
	  record model: 'UserRecords'
	  --> This would add function User.getUserRecords() to return all record entries for that user entry.
	  --> This would add function UserRecords.getUser() to get the original user from an record.

   If a model has associations, those would be mirrored to the record table.
   Origin model can only get its own records.
   Even if a record table is associated to another origin table thought a foreign key field, the record table is not accessible from that origin table

   Basically, what you can access in the origin table can be accessed from the record table.

   example:
	model: User
	record model: UserRecords

	model: Creation
	record model: CreationRecords

	User <-> Creation: 1 to many

	User.getCreations() exists (1 to many)
	Creation.getUser() exists (1 to 1)	

	User <-> UserRecords: 1 to many

	User.getUserRecords() exists (1 to many)
	UserRecords.getUser() exists (1 to 1)

	Creation <-> CreationRecords: 1 to many

	Creation.getCreationRecords() exists (1 to many)
	CreationRecords.getCreation() exists (1 to 1)

	CreationRecords -> User: many to 1

	CreationRecords.getUser() exists (1 to 1) (same as Creation.getUser())
	User.GetCreationRecords DOES NOT EXIST. THE ORIGIN TABLE IS NOT MODIFIED.

	UserRecords -> Creation: many to many

	UserRecords.getCreations() exists (1 to many) (same as User.getCreations())
	CreationRecords.getUser() DOES NOT EXIST. THE ORIGIN TABLE IS NOT MODIFIED.

  */
  addAssociations: false
```

Details
--------

@See: https://wiki.postgresql.org/wiki/SQL2011Record

### Record table

Record table stores record versions of rows, which are inserted by triggers on every modifying operation executed on current table. It has the same structure and indexes as current table, but it doesn’t have any constraints. Record tables are insert only and creator should prevent other users from executing updates or deletes by correct user rights settings. Otherwise the record can be violated.

### Hooks

Triggers for storing old versions of rows to record table are inspired by referential integrity triggers. They are fired for each row before UPDATE and DELETE (within the same transaction)

### Notes

If you only use Postgres, you might want to have a look at the [Record Table](https://github.com/arkhipov/record_tables) extension.

License
-------

The MIT License (MIT)

Copyright (c) 2015 BonaVal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

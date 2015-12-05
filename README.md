Temporal tables for Sequelize
=============================
(aka "Historical records")

[![Build Status](https://travis-ci.org/bonaval/sequelize-temporal.svg?branch=master)](https://travis-ci.org/bonaval/sequelize-temporal) [![Dependency Status](https://david-dm.org/bonaval/sequelize-temporal.svg)](https://david-dm.org/bonaval/sequelize-temporal) [![NPM version](https://img.shields.io/npm/v/sequelize-temporal.svg)](https://www.npmjs.com/package/sequelize-temporal)


What is it?
-----------

Temporal tables maintain __historical versions__ of data. Modifying operations (UPDATE, DELETE) on these tables don't cause permanent changes to entries, but create new versions of them. Hence this might be used to:

- log changes (security/auditing)
- undo functionalities
- track interactions (customer support)

Under the hood a history table with the same structure, but without constraints is created.

The normal singular/plural naming scheme in Sequelize is used

- table name:  `tableName() + Histories`
- model name: `tableName() + History`

Installation
------------

```
npm install sequelize-temporal
```

How to use
----------

### 1) Import `sequelize-temporal`

```
var Sequelize = require('sequelize');
var Temporal = require('sequelize-temporal');
```

Create a sequelize instance and your models, e.g.

```
var sequelize = new Sequelize('', '', '', {
	dialect: 'sqlite',
	storage: __dirname + '/.test.sqlite'
});
```

### 2) Add the *temporal* feature to your models

```
var User = Temporal(sequelize.define('User'), sequelize);
```

The output of `temporal` is its input model, so assigning it's output to your
Model is not necessary, hence it's just the lazy version of:

```
var User = sequelize.define('User', {.types.}, {.options.}); // Sequelize Docu
Temporal(User, sequelize);
```

Options
-------

The default syntax for `Temporal` is:

`Temporal(model, sequelizeInstance, options)`

whereas the options are listed here (with default value).

```
// runs the insert within the sequelize hook chain, disable
// for increased performance without warranties
blocking: true 
```

Details
--------

@See: https://wiki.postgresql.org/wiki/SQL2011Temporal

### History table

History table stores historical versions of rows, which are inserted by triggers on every modifying operation executed on current table. It has the same structure and indexes as current table, but it doesn’t have any constraints. History tables are insert only and creator should prevent other users from executing updates or deletes by correct user rights settings. Otherwise the history can be violated.

### Hooks

Triggers for storing old versions of rows to history table are inspired by referential integrity triggers. They are fired for each row before UPDATE and DELETE (within the same transaction)

### Notes

If you only use Postgres, you might want to have a look at the [Temporal Table](https://github.com/arkhipov/temporal_tables) extension.

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

seraph-resource
====================

creates a [controller](http://github.com/brikteknologier/controller) with crud
methods for a [seraph](http://github.com/brikteknologier/seraph)
[model](http://github.com/brikteknologier/seraph-model).

# example

## setup

```javascript
var db = require('seraph')('http://localhost:7474');
var User = require('seraph-model')(db, 'user');
var resource = require('seraph-resource');

var express = require('express');
var app = express();
app.use(express.bodyParser());

resource(User).attach(app);

app.listen(3000);
```

## in action

__Create a new node__
```
>> curl -d '{"name":"Jon","age":23}' http://localhost:3000/user/ -H "Content-type: application/json"
{"name":"Jon","age":23,"id":8}
```

__Read an existing node__
```
>> curl http://localhost:3000/user/8
{"name":"Jon","age":23,"id":8}
```

__Update a node__
```
>> curl -X PUT -d '{"name":"Jon Packer","age":23}' http://localhost:3000/user/8 -H "Content-type: application/json"
{"name":"Jon Packer","age":23,"id":"8"}
```

__Delete a node__
```
>> curl -X DELETE http://localhost:3000/user/8
OK
```

# usage
## resource(seraphModel, [options])

Creates a controller with CRUD actions implemented and routed for the given
seraph model. 

## options
* __root__ the service root. defaults to `/`. for example, if root = `/data`,
  and the model's type is `'user'`, a functions will be routed at
  `/data/user/`.

## default actions

CRUD actions:

* `'read'` read a node and send as json
* `'create'` create a new node
* `'update'` update a node
* `'delete'` delete a node

In addition, if the model has `fields` defined, CRUD actions are provided for
each field. For example, if model.fields includes `'name'`, these actions are
defined: `'read:name'`, `'create:name'`, `'update:name'`, and `'delete:name'`.

## default routes

If `model.type` is set `'model'`:

```
GET    /model/:model -> 'read'
POST   /model/       -> 'create'
PUT    /model/:id?   -> 'update'
DELETE /model/:id?   -> 'delete'

additionally, if fields are defined

GET    /model/:model/field -> 'read:field'
POST   /model/:model/field -> 'create:field'
PUT    /model/:model/field -> 'update:field'
DELETE /model/:model/field -> 'delete:field'
```

## express param

When the resource is attached to an instance of express, it also uses
[express.param](http://expressjs.com/api.html#app.param) to define some
middleware to resolve the model every time it is specified in the route.

__example__
```javascript
var User = model(db, 'user');
app.get('/posts/:user', function(req, res) {
  // Because :user was defined on the route, `req.user` is now set to the user
  // specified by the id passed at that point. 
  Posts.where({user: req.user.id}, function(err, posts) {
    res.json(posts);
  });
});
```
seraph-resource
====================

creates a [controller](http://github.com/brikteknologier/controller) with crud
methods for a [seraph](http://github.com/brikteknologier/seraph)
[model](http://github.com/brikteknologier/seraph-model).

# why?

[seraph](http://github.com/brikteknologier/seraph) gives us access to a neo4j 
db. [seraph-model](http://github.com/brikteknologier/seraph-model) gives us
models for this db. __seraph-resource__ gives us a base controller for these
models. 

# install

`npm install seraph-resource`

# example

## setup

```javascript
var db = require('seraph')('http://localhost:7474');
var User = require('seraph-model')(db, 'user');
var resource = require('seraph-resource');

var express = require('express');
var app = express();
var Users = resource(User);

app.use(Users);
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

__And more!__

# usage
## resource(seraphModel, [options])

Creates a [controller](http://github.com/brikteknologier/controller) with CRUD 
actions implemented and routed for the given seraph model. 

**options**

* `relRoutes`: (defaults to false) - add routes that expose the ability to
  create, read and update relationships to and from the model. This is turned off
  by default because there is no easy way to consistently control access to the
  nodes being modified, and because it can create some security loopholes. If 
  this is not a concern for your usecase, you can turn it on. The routes that are
  added are listed in the 'default actions' section below as 'rel:read', 
  'rel:nodes', and 'rel:create'.
* `strictContentType`: (defaults to true) - only accept `application/json`
  content types. If set to false, more abstract content types such as formdata
  will be parsed by [connect-bodyParser](http://www.senchalabs.org/connect/middleware-bodyParser.html) as well.

### Default actions

* `'read'` read a node and send as json (required params: `:<model.type>`)
* `'create'` create a new node
* `'update'` update a node (required params: `:_id?`)
* `'update-root'` update the root of a model (exclude compositions). required
  params: `:_id?`.
* `'delete'` delete a node (required params: `:_id?`)

#### Only available if `relRoutes` option is specified

* `'rel:read'` read the node's relationships (required params: 
  `:_id`, `:_type`, `:_direction`)
* `'rel:nodes'` read the node's related nodes (required params:
  `:_id`, `:_type`, `:_direction`)
* `'rel:create'` create a relationship (required params: `:_from`, `:_type`,
  `:_to`

In addition, if the model has `fields` defined, CRUD actions are provided for
each field. For example, if model.fields includes `'name'`, these actions are
defined: `'read:name'`, `'create:name'`, `'update:name'`, and `'delete:name'`.
These all take a `:<model.type>` param.

\*\**note - params are prefixed with an underscore to prevent conflict with
model types*

## default routes

If `model.type` is set `'model'`:

```
GET    /model/:model                        -> 'read'
POST   /model/                              -> 'create'
PUT    /model/:_id?                         -> 'update'
PUT    /model/root/:_id?                    -> 'update-root'
DELETE /model/:_id?                         -> 'delete'

these are only available if the "relRoutes" option is specified

GET    /model/:_id/rel/:_type/:_direction?  -> 'rel:read'
GET    /model/:_id/rel/:_type/:_direction?/nodes -> 'rel:nodes'
POST   /model/:_from/rel/:_type/:_to        -> 'rel:create'

additionally, if fields are defined (replace 'field' with the target field below)

GET    /model/:_id/field -> 'read:field'
POST   /model/:_id/field -> 'create:field'
PUT    /model/:_id/field -> 'update:field'
DELETE /model/:_id/field -> 'delete:field'

for compositions: (replace 'comp' with the target comp name below)

GET   /model/:model/comp -> 'read:comp' (model.readComposition)
POST  /model/:_id/comp -> 'push:comp' (model.push)
PUT   /model/:_id/comp -> 'update:comp' (model.saveComposition)

```

\*\**note - params are prefixed with an underscore to prevent conflict with
model types*

## middleware groups

Resource groups each of the actions into middleware groups to make it easier
for you to apply targeted middleware for actions. For more information on how
the groups work, see the [docs in controller](https://github.com/brikteknologier/controller#groups).

* `'relationships'` actions that will work with relationships (note that there
  will be nothing in this group unless relationship routes are turned on)
* `'properties'` actions that will work with individual properties
* `'compositions'` actions the work with composited nodes

## express param

Each resource has a `param` property which can be used to resolve instances of
this model when specified in express routes. For example:

__example__
```javascript
var User = model(db, 'user');
app.param(':user', User.param);
app.get('/posts/:user', function(req, res) {
  // Because :user was defined on the route, `req.user` is now set to the user
  // specified by the id passed at that point. 
  Posts.where({user: req.user.id}, function(err, posts) {
    res.json(posts);
  });
});
```

## complete demonstration

### Server

```javascript
var db = require('seraph')('http://localhost:7474');
var User = require('seraph-model')(db, 'user');
var resource = require('seraph-resource');

var express = require('express');
var app = express();

User.fields = ['name', 'age', 'country'];
var Users = resource(User);

app.use(Users);
app.listen(3000);
```


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

__Create a relationship__
```
>> curl -d '{"since":"2005"}' http://localhost:3000/user/8/rel/friend/6 -H "Content-type: application/json"
{"from":8,"to":6,"id":0,"type":"friend","properties":{"since":"2005"}}
```

__Read a relationship__
```
>> curl http://localhost:3000/user/8/rel/friend/out
[{"from":8,"to":6,"id":0,"type":"friend","properties":{"since":"2005"}}]
```

__Create a property__
```
>> curl -d '"Australia"' http://localhost:3000/user/8/country -H "Content-type: application/json"
{"name":"Jon","age":23,"id":8,"country":"Australia"}
```

__Read an existing property__
```
>> curl http://localhost:3000/user/8/country
"Australia"
```

__Update a node__
```
>> curl -X PUT -d '"Norway"' http://localhost:3000/user/8/country -H "Content-type: application/json"
{"name":"Jon Packer","age":23,"id":"8","country":"Norway"}
```

__Delete a node__
```
>> curl -X DELETE http://localhost:3000/user/8/country
{"name":"Jon Packer","age":23,"id":"8"}
```

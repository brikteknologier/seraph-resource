seraph_model_express
====================

expose crud functions for a seraph model over http

# example

## setup

```javascript
var db = require('seraph')('http://localhost:7474');
var User = require('seraph_model')(db, 'user');
var expose = require('seraph_model_express');

var express = require('express');
var app = express();
app.use(express.bodyParser());

expose(app, User);

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
### seraph_model_express(expressInstance, seraphModel, [options])

Takes an instance of express and adds the crud routes given a seraph model.

## options
* __root__ the service root. defaults to `/`. for example, if root = `/data`,
  and the model's type is `'user'`, a functions will be routed at
  `/data/user/`.
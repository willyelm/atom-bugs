// Atom Bugs: Test
var title = `This package is a integrated client of
  NodeJS Debugger which uses the V8 Debugging Protocol,
  in this first version it works for NodeJS applications
  only. but I am looking forward to enable browser
  debugging.`

function Greet (msg) {
  console.log(msg)
}

Greet(title)

let object = {
  title: 'Some Object'
}

Greet(object)
// // Hello
// var variables = [
//   'Hello World',
//   {
//     title: 'Some Object'
//   },
//   [1, 2, 3],
//   new Date(),
//   true,
//   123123]
//
// variables.forEach((m) => {
//   Greet(m)
// })

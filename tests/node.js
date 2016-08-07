// Atom Bugs: Test
var project = require('./node2')
var variables = [
  'Hello World',
  {
    title: 'Some Object'
  },
  [1, 2, 3],
  new Date(),
  true,
  123123]

function Greet (msg) {
  console.log(msg)
}

variables.forEach((m) => {
  Greet(m)
})

Greet(project.getMessage())

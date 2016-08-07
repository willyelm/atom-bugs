// Atom Bugs: Test
function Greet (msg) {
  console.log(msg)
}
// Hello
var variables = [
  'Hello World',
  {
    title: 'Some Object'
  },
  [1, 2, 3],
  new Date(),
  true,
  123123]

variables.forEach((m) => {
  Greet(m)
})

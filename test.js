// Atom Bugs: Test
var title = `Basically the only thing happening
  here is that when the class is created,
  it creates a simple div`

function Greet (msg) {
  console.log(msg)
}

Greet(title)

// Hello
var variables = [
  'Hello World',
  {
    title: 'Some Object'
  },
  [1, 2, 3],
  new Date(),
  true,
  123123,
  function () {
    console.log('hello')
  }]

variables.forEach((m) => {
  Greet(m)
})

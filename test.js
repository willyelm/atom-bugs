// Atom Bugs: Test
var title = 'View'
var test = 1 + 2

function Greet (msg) {
  // do something with the msg
}

// Hello
[
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
  }
]
.forEach((m) => {
  Greet(m)
})

console.log(`Basically the only thing happening
  here is that when the ${title} class is created,
  it creates a simple div ${test}`)

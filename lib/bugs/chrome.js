// runChromeAndConnect: {
//   value (options) {
//     return new Promise((resolve, reject) => {
//       let selenium = require('selenium-webdriver')
//       let chrome = require('selenium-webdriver/chrome')
//       require('chromedriver')
//       let chromeOptions = new chrome.Options()
//       // add arguments
//       chromeOptions.addArguments([
//         // '--show-fps-counter',
//         // '--disable-extensions',
//         // `--remote-debugging-port=${this.settings.port}`,
//         // `--remote-debugging-address=${this.settings.hostname}`
//       ])
//       let driver = new selenium
//         .Builder()
//         .withCapabilities(chromeOptions.toCapabilities())
//         .build()
//       driver.get(options.url || 'http://willyelm.com')
//       console.log('driver', driver)
//       resolve(this.connect())
//     })
//   }
// }

function BugsChrome () {

}

BugsChrome.prototype = Object.create({}, {
  //
})

module.exports = BugsChrome

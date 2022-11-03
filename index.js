const express = require('express')
const app = express()
const PORT = 8000


app.listen(PORT, () => {
    console.log(`Server is running at PORT http://localhost:${PORT}`)
})

module.exports = app
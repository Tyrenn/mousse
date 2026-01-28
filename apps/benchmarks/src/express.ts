import express from 'express'

const app = express()

app.get('/hello', (req, res) => {
	res.send('Hello from express')
})

app.listen(3001, () => {
	console.log('Express listening on http://localhost:3001')
})
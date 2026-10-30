import { app } from './app.js'
const port = Number(process.env.PORT || 3000)
app.listen(port, '0.0.0.0', () => console.log(`Gym Track running on http://0.0.0.0:${port}`))

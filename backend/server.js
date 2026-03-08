const express=require("express");
const http=require("http");
const socketIo=require("socket.io");
const bodyParser=require("body-parser");
const authRoutes=require("./routes/authRoutes");
const issueRoute=require("./routes/issueRoute");
const documentRoutes=require("./routes/documentRoutes");
const knowledgebaseRoutes=require("./routes/knowledgebaseRoutes");
const roleRoutes=require("./routes/roleRoutes");
const teamChatRoutes=require("./routes/teamChatRoutes");
const externalApiRoutes=require("./routes/externalApiRoutes");
const apiKeyRoutes=require("./routes/apiKeyRoutes");
const auditLogRoutes=require("./routes/auditLogRoutes");
const cors=require("cors");
const jwt=require("jsonwebtoken");
const { TeamChat } = require("./model/collection");
const PORT=3001;

const app=express();
// Trust proxy to capture real client IPs from x-forwarded-for when behind reverse proxies
app.set('trust proxy', true);
const server=http.createServer(app);
const serverStartTime = Date.now();
const io=socketIo(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

// Activity logger (log all HTTP requests except excluded ones)

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime_ms: Math.round(Date.now() - serverStartTime),
        timestamp: new Date().toISOString()
    });
});

app.use("/auth",authRoutes);
app.use("/issue",issueRoute);
app.use("/document",documentRoutes);
app.use("/knowledgebase",knowledgebaseRoutes);
app.use("/role",roleRoutes);
app.use("/team-chat",teamChatRoutes);
app.use("/api/v1", externalApiRoutes);
app.use("/api-keys",apiKeyRoutes);
app.use("/audit/logs",auditLogRoutes);

// Socket.io authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (Company: ${socket.user.company_id})`);
    
    // Join company room
    const companyRoom = `company_${socket.user.company_id}`;
    socket.join(companyRoom);
    // Join personal room for direct messages
    const personalRoom = `user_${socket.user.id}`;
    socket.join(personalRoom);
    
    // Handle team chat message
    socket.on('team_message', async (data) => {
        try {
            const teamChat = new TeamChat({
                company_id: socket.user.company_id,
                user_id: socket.user.id,
                user_name: socket.user.name,
                category: 'team',
                message: data.message
            });
            
            await teamChat.save();
            
            // Broadcast to all users in the same company
            io.to(companyRoom).emit('team_message', {
                id: teamChat.id,
                user_id: teamChat.user_id,
                user_name: teamChat.user_name,
                category: 'team',
                message: teamChat.message,
                timestamp: teamChat.timestamp
            });
        } catch (error) {
            console.error('Error saving team chat:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });
    
    // Handle private (1:1) message
    socket.on('private_message', async (data) => {
        try {
            const { toUserId, toUserName, message } = data;
            if (!toUserId || !message) {
                return socket.emit('error', { message: 'Invalid private message payload' });
            }

            const privateMsg = new TeamChat({
                company_id: socket.user.company_id,
                user_id: socket.user.id,
                user_name: socket.user.name,
                to_user_id: toUserId,
                to_user_name: toUserName || '',
                category: 'private',
                message
            });

            await privateMsg.save();

            const payload = {
                id: privateMsg.id,
                user_id: privateMsg.user_id,
                user_name: privateMsg.user_name,
                to_user_id: privateMsg.to_user_id,
                to_user_name: privateMsg.to_user_name,
                category: 'private',
                message: privateMsg.message,
                timestamp: privateMsg.timestamp
            };

            // Emit to sender and recipient personal rooms
            io.to(`user_${socket.user.id}`).emit('private_message', payload);
            io.to(`user_${toUserId}`).emit('private_message', payload);
        } catch (error) {
            console.error('Error saving private chat:', error);
            socket.emit('error', { message: 'Failed to send private message' });
        }
    });
    
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.name}`);
    });
});

server.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`);
});
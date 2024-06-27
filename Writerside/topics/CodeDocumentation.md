
# Code Documentation

## Code Structure

### Overview of the Project’s Directory Structure
The project is divided into three main directories: `backend-server`, `chaincode`, and `frontend_server`.

```
ovote-main/
├── backend-server/
├── chaincode/
└── frontend_server/
```

### Description of Key Directories and Files

#### `backend-server/`
This directory contains the server-side code responsible for handling API requests, interacting with the database, and other backend services.

- `.env`: Environment variables for the backend server.
- `Readme.md`: Documentation for setting up and running the backend server.
- `package.json`: Lists dependencies and scripts for the backend server.
- `server.js`: Main entry point for the backend server.

**Subdirectories:**

- `config/`
  - `db-config.js`: Configuration for the database connection.
- `controllers/`
  - `agenda-controller.js`: Handles CRUD operations for agendas.
  - `record-controller.js`: Manages voting records.
  - `user-controller.js`: Manages user operations such as registration and login.
- `middleware/`
  - `auth.js`: Middleware for authentication.
  - `error-handler.js`: Middleware for handling errors.
- `models/`
  - `agenda-model.js`: Schema and model for agenda.
  - `record-model.js`: Schema and model for voting records.
  - `user-model.js`: Schema and model for users.
- `routes/`
  - `agenda-routes.js`: Defines routes for agenda-related operations.
  - `record-routes.js`: Defines routes for voting record operations.
  - `user-routes.js`: Defines routes for user operations.
- `services/`
  - `fabric-gateway-service.js`: Handles interactions with the Hyperledger Fabric gateway.
  - `rabbitmq-service.js`: Manages messaging with RabbitMQ.
  - `verification-service.js`: Provides verification services for users.

#### `chaincode/`
This directory contains the chaincode (smart contracts) for the Hyperledger Fabric blockchain.

- `chaincode.go`: Main chaincode file written in Go.
- `go.mod`: Module file for Go dependencies.
- `go.sum`: Checksum file for Go dependencies.

#### `frontend_server/`
This directory contains the client-side code for the frontend of the application.

- `.env`: Environment variables for the frontend server.
- `README.md`: Documentation for setting up and running the frontend server.
- `index.html`: Main HTML file for the frontend.
- `package.json`: Lists dependencies and scripts for the frontend server.
- `vite.config.js`: Configuration for Vite (build tool).
- `vitest.config.js`: Configuration for Vitest (testing framework).

**Subdirectories:**

- `public/`
  - `favicon.ico`: Favicon for the website.
- `src/`
  - `App.vue`: Root component of the Vue.js application.
  - `main.js`: Entry point for the Vue.js application.
  - `assets/`: Contains static assets like images.
  - `components/`: Vue.js components for different parts of the application.
    - `LoginForm.vue`: Login form component.
    - `SignupForm.vue`: Signup form component.
    - `admin/`: Components for admin users.
      - `AgendaManage.vue`: Manage agendas.
      - `KibanaEmbed.vue`: Embed Kibana dashboard.
      - `UserManage.vue`: Manage users.
    - `user/`: Components for regular users.
      - `AgendaList.vue`: List of agendas.
      - `MyVoted.vue`: List of agendas the user has voted on.
      - `Trending.vue`: List of trending agendas.
  - `router/`
    - `index.js`: Defines routes for the Vue.js application.
  - `stores/`: Vuex stores for state management.
    - `agenda-store.js`: Store for agenda-related state.
    - `auth-store.js`: Store for authentication-related state.
    - `user-store.js`: Store for user-related state.
  - `views/`: Vue.js views for different pages.
    - `AdminView.vue`: Admin dashboard view.
    - `AuthView.vue`: Authentication view (login/signup).
    - `UserView.vue`: User dashboard view.

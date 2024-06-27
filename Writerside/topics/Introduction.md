# Introduction

## Project Overview
This secure and anonymous online voting system provides a seamless and efficient voting process while ensuring voter privacy. Catering to both administrators and users, it offers distinct functionalities based on roles. Built with Vue.js for a responsive UI and Express.js for backend management, it leverages Hyperledger Fabric for blockchain verification to ensure data integrity and security, and MongoDB for secure and efficient data storage. Additionally, RabbitMQ is integrated for asynchronous processing, distributing incoming requests across multiple servers and decoupling request processing from the backend to ensure high availability and scalability. This system utilizes advanced technologies to maintain responsiveness under heavy load.

## Key Features

### Distinct Roles for Administrators and Users
- Separate functionalities, pages, and routing for administrators and users
- Both roles use the same login page

### Administrator Functions
- Display a list of agenda items
- Create, modify, delete agenda items, and view results
- Verify and compare voting results (database vs. blockchain)
- Cannot modify ongoing or completed voting processes

### User Functions
- Display a list of agenda items
- View agenda item information
- Cast votes on agenda items
- Verify and compare voting results (database vs. blockchain)
- Cannot vote on agenda items that have not started or have already ended
- Voting records are stored on the blockchain

### Login Functionality
- Administrators and users log in through the same login screen
- After login, administrators are directed to the admin page, and users to the user page
- Provides sign-up features

### Database Schema
- Agenda: Creation time, name, description, start time, end time, options (array)
- User: Name, email, password, organization, list of voted agenda items
- Voting Record: Voting organization, agenda ID, creation time, selected option

### Blockchain Verification
- Integrate Hyperledger Fabric for storing voting records
- Compare consistency between MongoDB and the blockchain
- Define chaincode for voting records

### Asynchronous Processing with RabbitMQ
- Use RabbitMQ for asynchronous processing of voting requests
- Prevent bottlenecks and improve overall system responsiveness
- Handle tremendous voting requests, verification, and result fetching

## Technologies Used

### Operating Systems
- **Mac OS:** Sonoma
- **WSL:** Ubuntu 22.04 LTS

### Frontend
- **Framework:** Vue 3 with Vuetify 3
- **State Management:** Pinia v2.1.7
- **Design Pattern:** MVVM (Model-View-ViewModel)
- **Routing:** Separate routes for admin and user pages
- **SPA:** Seamless user experience with dynamic content loading

### Backend
- **Node.js:** v20.12.2 LTS
- **Npm:** v10.5.0
- **Fabric Gateway Client API:** v1.5.1
- **Express.js:** v4.19.2
- **Design Pattern:** MVC (Model-View-Controller)
- **REST API:** Exposes endpoints for client interactions
- **Authentication:** Robust login and session management

### Database
- **MongoDB:** v7.0.11 Flexible and scalable data storage

### Blockchain
- **Hyperledger Fabric:** v2.5.7 LTS
- **Hyperledger Fabric Go Contract API:** v1.2.2
- **Go:** v1.20.14
- **Docker:** v4.30 Containerization
- **Fabric Gateway:** v1.5.1 Connects blockchain and backend
- **Chaincode:** Manages voting records

### Asynchronous Processing
- **RabbitMQ:** v3.13.3 Message broker for asynchronous processing

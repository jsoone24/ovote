# ovote: Blockchain based Online Voting System

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

### Database
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

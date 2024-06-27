
# Usage Documentation

## Basic Usage
### Starting the Blockchain Network
Refer to the [Hyperledger Fabric documentation](https://hyperledger-fabric.readthedocs.io/en/release-2.5/test_network.html) for details. To start the network, navigate to the test network directory and execute the script:
```Shell
cd ~/ovote/fabric-samples/test-network
./network.sh up createChannel -ca
```
You can specify a custom channel name using the `-c` option. The default channel name is 'mychannel'. For example:
```Shell
./network.sh createChannel -c channel1
```

### Deploying Chaincode on the Blockchain Network
Deploy chaincode using the following command:
```Shell
./network.sh deployCC -ccn ovote -ccp ../../chaincode -ccl go
```
- `-ccn`: Chaincode name
- `-ccp`: Chaincode path
- `-ccl`: Chaincode language

### Starting the RabbitMQ Server
For macOS:
```Shell
rabbitmq-server
```

For WSL Ubuntu 22.04 LTS:
```Shell
sudo systemctl start rabbitmq-server
sudo systemctl enable rabbitmq-server
```

### Running the Backend Server
Navigate to the backend server directory and start the server:
```Shell
cd ~/ovote/backend-server
npm run dev
```

### Running the Frontend Server
Navigate to the frontend server directory and start the server:
```Shell
cd ~/ovote/frontend-server
npm run dev
```

## Advanced Features
### Use Case
```mermaid
flowchart
	Register/Login --> User
	Register/Login --> Admin
	
    User<-- View Vote Agendas -->Server
    User<-- Verify Records -->Server
    Admin<-- View Manage Agendas -->Server
    Admin<-- Verify Records -->Server

    Server --- id1[(Database)]
    Server --- Blockchain
    Server --- RabbitMQ
```

1. **User Registration/Login**:
   - Users register with hashed passwords stored in the database.
   - Login credentials are verified against the stored hashed passwords.

2. **Agenda Management (Admin)**:
   - Admins can create, modify, and delete agendas, except for those in progress or completed.

3. **Voting Process (User)**:
   - Users view and vote on active agendas.
   - Votes are encrypted and stored as blockchain transactions.
   - Transactions are queued in RabbitMQ and processed asynchronously.
   - Votes are anonymously recorded in the database using hashed orgID and salt.

4. **Verification**:
   - Users and admins can verify content by comparing database records with blockchain records.

## Visual Aids

### Dataflow Component Diagrams
```mermaid
flowchart 
    subgraph Frontend_Server ["Frontend Server"]

        subgraph UserPage[User Page]
        AgendaList[Agenda List]
        MyVoted[My Voted]
        end

        subgraph AdminPage[Admin Page]
        AgendaManage[Agenda Manage]
        UserManage[User Manage]
        end

        RegisterLogin[(Register/Login)] --> UserPage[User Page]
        RegisterLogin[(Register/Login)] --> AdminPage[Admin Page]
        UserPage & AdminPage-- Request --> PiniaStore[Pinia Store]
    end

    subgraph Backend_Server ["Backend Server"]
        router[("Express.js Router")]
        router -->|Agenda CRUD| AgendaController[Agenda Controller]
        router -->|User CRUD/Auth/Login| UserController[User Controller]
        router -->|Vote Record| RecordController[Record Controller]
        router -.->|Agenda Verify| AgendaController
    end
    
    subgraph Data_Storage ["Data Storage"]
        AgendaController -->|CRUD| MongoDB[MongoDB]
        AgendaController .->|Compare| MongoDB[MongoDB]
        UserController -->|CRUD| MongoDB
        AgendaController -.->|Compare| HyperledgerFabric
        MongoDB --> AgendaSchema[Agenda Schema] & UserSchema[User Schema] & RecordSchema[Record Schema]
        HyperledgerFabric --> BlockchainRecord[Blockchain Record]
    end
    
        RecordController -->|Queue| RabbitMQ[RabbitMQ]
        RabbitMQ -->|Store| HyperledgerFabric[Hyperledger Fabric]
        RabbitMQ -->|Store| MongoDB
    PiniaStore -- HTTPS --> router
```

verifyAgendaConsistency 메소드 흐름도

```mermaid
flowchart 
    A[검증 요청] --> B{Force 옵션 \n 활성화 여부}
    B --> |활성화| C[무조건 검증 수행]
    C --> E
    B --> |비활성화| D[최근 투표 기록 시각과 \n 검증 시각 비교]
    D --> F{최근 검증 시각이 \n 이후인가?}
    F --> |예| G[최근 검증 기록 리턴]
    F --> |아니오| E[블록체인 데이터와 \n MongoDB 데이터 비교]
    E --> H{일치 여부 확인}
    H --> |일치/불일치| K[Agenda의 검증 시각과 \n 검증 기록 갱신]
```

검증요청시의 데이터흐름
```mermaid
sequenceDiagram
    participant 투표자/관리자
    participant Frontend
    participant Backend
    participant Blockchain
    participant MongoDB

    투표자/관리자->>Frontend: 검증 요청
    Frontend->>Backend: 검증 요청 API 호출
    Backend->>MongoDB: 검증할 Agenda 데이터 조회
    MongoDB-->>Backend: 검증할 Agenda 데이터 반환
    Backend->>Backend: 최근 기록 시각과 검증 시각 비교
    alt Force 옵션 활성화 또는 최근 기록 시각이 이후인 경우
        Backend->>Backend: 무조건 검증 수행
        Backend->>Blockchain: 블록체인 데이터 조회
        Backend->>MongoDB: MongoDB 데이터 조회
        Backend->>Backend: 데이터 일치 여부 확인 및 Agenda 데이터 갱신
    end
    Backend-->>Frontend: 검증 결과 반환
    Frontend-->>투표자/관리자: 검증 결과 표시
```

createRecord 메소드 흐름도
```mermaid
flowchart 
    A[투표 기록 요청] --> C[RabbitMQ에 메시지 큐잉]
    C --> E[메시지 큐에서 대기]
    E --> G[Queue에서 메시지 소비]
    G --> I[Record 모델에 맞게 투표 기록 생성]
    I --> J[MongoDB에 투표 기록 저장]
    J --> K[고유 ID 생성]
    K --> L[Agenda의 최근 투표 시각 및 선택지 투표수 갱신]
    L --> M[블록체인으로 투표 기록 전달 및 저장]
```

rabbitMQ메시지 처리 흐름도
```mermaid
sequenceDiagram
    participant 투표자
    participant Frontend
    participant Backend
    participant RabbitMQ
    participant Blockchain
    participant MongoDB

    투표자->>Frontend: 투표 기록 요청
    Frontend->>Backend: 투표 기록 요청 API 호출
    Backend->>RabbitMQ: 메시지 큐잉 (sendMessage 함수 호출)
    RabbitMQ-->>Backend: 메시지 큐에 저장됨
    RabbitMQ->>Backend: 메시지 소비 (processQueue 함수 호출)
    Backend->>MongoDB: 데이터 JSON 파싱, 투표 기록 저장
    MongoDB-->>Backend: 고유 ID 생성 및 저장 완료 응답
    Backend->>MongoDB: Agenda의 최근 투표 시각 및 선택지 투표수 갱신
    Backend->>Blockchain: 블록체인에 투표 기록 저장
    Blockchain-->>Backend: 저장 완료 응답
```

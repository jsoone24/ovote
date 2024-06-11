package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// OVoteContract provides functions for managing a record
type OVoteContract struct {
	contractapi.Contract
}

// Record represents the basic data structure of a block
type Record struct {
	AgendaID         string `json:"agendaId"`
	OrganizationHash string `json:"organizationHash"`
	SelectedOption   string `json:"selectedOption"`
	CreatedAt        string `json:"createdAt"`
	Salt             string `json:"salt"`
	ID               string `json:"_id"`
}

func (oc *OVoteContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	return nil
}

// CreateRecord creates a new record
func (oc *OVoteContract) CreateRecord(ctx contractapi.TransactionContextInterface, recordJson string) error {
	var record Record
	err := json.Unmarshal([]byte(recordJson), &record)
	if err != nil {
		return fmt.Errorf("error occurred during unmarshalling: %v", err)
	}

	exists, err := oc.RecordExists(ctx, record.ID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the asset %s already exists", record.ID)
	}

	return ctx.GetStub().PutState(record.ID, []byte(recordJson))
}

// GetRecord retrieves all records
func (oc *OVoteContract) GetRecord(ctx contractapi.TransactionContextInterface) ([]*Record, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []*Record
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var record Record
		err = json.Unmarshal(queryResponse.Value, &record)
		if err != nil {
			return nil, err
		}
		records = append(records, &record)
	}

	return records, nil
}

// RecordExists checks if a record exists in the world state
func (oc *OVoteContract) RecordExists(ctx contractapi.TransactionContextInterface, voteId string) (bool, error) {
	recordJson, err := ctx.GetStub().GetState(voteId)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return recordJson != nil, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(new(OVoteContract))
	if err != nil {
		log.Panicf("Error creating OVote chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting OVote chaincode: %v", err)
	}
}

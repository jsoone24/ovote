package main

import (
	"crypto/sha256"
	"encoding/base64"
	"strconv"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

const (
	agendaPrefix     = "agenda"
	ballotPrefix     = "ballot"
	credentialPrefix = "credential"
	decryptPrefix    = "decrypt"
	resultPrefix     = "result"
)

func agendaKey(ctx contractapi.TransactionContextInterface, id string) (string, error) {
	return ctx.GetStub().CreateCompositeKey(agendaPrefix, []string{id})
}

func ballotKey(ctx contractapi.TransactionContextInterface, agendaId, ballotId string) (string, error) {
	return ctx.GetStub().CreateCompositeKey(ballotPrefix, []string{agendaId, ballotId})
}

// credentialNullifierKey enforces one-ballot-per-credential. The nullifier is a
// domain-separated SHA-256 of the blind signature, so the raw signature never
// leaves the ballot payload but double-use is still detectable.
func credentialNullifierKey(ctx contractapi.TransactionContextInterface, agendaId string, signatureB64Url string) (string, error) {
	h := sha256.New()
	h.Write([]byte("ovote/v1/credential-nullifier/"))
	h.Write([]byte(agendaId))
	h.Write([]byte("/"))
	h.Write([]byte(signatureB64Url))
	nullifier := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
	return ctx.GetStub().CreateCompositeKey(credentialPrefix, []string{agendaId, nullifier})
}

func decryptionShareKey(ctx contractapi.TransactionContextInterface, agendaId, optionId string, trusteeIndex int) (string, error) {
	return ctx.GetStub().CreateCompositeKey(decryptPrefix, []string{agendaId, optionId, strconv.Itoa(trusteeIndex)})
}

func resultKey(ctx contractapi.TransactionContextInterface, agendaId string) (string, error) {
	return ctx.GetStub().CreateCompositeKey(resultPrefix, []string{agendaId})
}

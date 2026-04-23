package main

import (
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// Access control is modelled after MSP role attributes. For v1 we rely on the
// organisation's MSP to issue certificates whose custom attributes identify
// privileged principals:
//
//   - role=admin     can create, open, close, and tally agendas
//   - role=trustee   can submit decryption shares
//   - role=registrar can post ballots on behalf of voters (the voter signs
//                    the ballot transcript client-side; the registrar relays)
//
// Voters themselves do not transact on-chain. The registrar relays ballots,
// and anonymity is protected by the blind-signed credential (the registrar
// cannot link a credential to a voter identity).

const (
	attrRole = "ovote.role"

	roleAdmin     = "admin"
	roleTrustee   = "trustee"
	roleRegistrar = "registrar"
)

func requireRole(ctx contractapi.TransactionContextInterface, role string) error {
	cid := ctx.GetClientIdentity()
	val, found, err := cid.GetAttributeValue(attrRole)
	if err != nil {
		return fmt.Errorf("read role attribute: %w", err)
	}
	if !found {
		return fmt.Errorf("caller has no %q attribute", attrRole)
	}
	if val != role {
		return fmt.Errorf("caller role %q does not match required role %q", val, role)
	}
	return nil
}

func callerID(ctx contractapi.TransactionContextInterface) (string, error) {
	return ctx.GetClientIdentity().GetID()
}

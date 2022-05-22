package ovote

import (
	"github.com/hyperledger/fabric/core/chaincode/shim"
)

type Owner struct {
	Id string
}

type Vote struct {
	HId string
	VId string
	OwnerId string
	Content string
}

type OVote interface {
	AddOwner(shim.ChaincodeStubInterface, *Owner) error
	CheckOwner(shim.ChaincodeStubInterface, string) (bool, error)
	ListOwners(shim.ChaincodeStubInterface) ([]*Owner, error)

	AddVote(shim.ChaincodeStubInterface, *Vote) error
	CheckVote(shim.ChaincodeStubInterface, string) (bool, error)
	ValidateVote(shim.ChaincodeStubInterface, *Vote) (bool, error)
	GetVote(shim.ChaincodeStubInterface, string) (*Vote, error)
	ListVotes(shim.ChaincodeStubInterface) ([]*Vote, error)
	ListOwnerIdVotes(shim.ChaincodeStubInterface, string) ([]*Vote, error)
}
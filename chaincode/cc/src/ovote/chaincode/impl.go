package chaincode

import (
	"ovote"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"github.com/jinzhu/inflection"
	"strings"
)

func checkLen(logger *shim.ChaincodeLogger, expected int, args []string) error{
	if len(args) < expected {
		mes :=fmt.Sprintf(
			"not enough number of arguments: %d given, %d expected",
			len(args),
			expected,
		)
		logger.Warning(mes)
		return errors.New(mes)
	}
	return nil
}

type OVoteCC struct {
}

func (this *OVoteCC) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger := shim.NewLogger("ovote")
	logger.Info("chaincode initialized")
	return shim.Success([]byte{})
}

func (this *OVoteCC) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger := shim.NewLogger("ovote")

	//sample of API use: show tX timestamp
	timestamp, err := stub.GetTxTimestamp()
	if err!= nil {
		return shim.Error(fmt.Sprintf("failed to get TX timestamp: %s", err))
	}
	logger.Infof(
		"Invoke called: Tx ID = %s, timestamp = %s", 
		stub.GetTxID(),
		timestamp,
	)
	var (
		fcn string
		args []string
	)
	fcn, args = stub.GetFunctionAndParameters()
	logger.Infof("function name = %s", fcn)

	switch fcn {
	// adds a new Owner
	case "AddOwner":
		// checks arguments length
		if err := checkLen(logger, 1, args); err != nil {
			return shim.Error(err.Error())
		}

		// unmarshal
		owner := new(ovote.Owner)
		err := json.Unmarshal([]byte(args[0]), owner)
		if err != nil {
			mes := fmt.Sprintf("failed to unmarshal Owner JSON: %s", err.Error())
			logger.Warning(mes)
			return shim.Error(mes)
		}

		err = this.AddOwner(stub, owner)
		if err != nil {
			return shim.Error(err.Error())
		}

		// returns a success value
		return shim.Success([]byte{})

		// lists Owners
	case "ListOwners":
		owners, err := this.ListOwners(stub)
		if err != nil {
			return shim.Error(err.Error())
		}

		// marshal
		b, err := json.Marshal(owners)
		if err != nil {
			mes := fmt.Sprintf("failed to marshal Owners: %s", err.Error())

			logger.Warning(mes)
			return shim.Error(mes)
		}

		// returns a success value
		return shim.Success(b)

		// adds a new Vote
	case "AddVote":
		// checks arguments length
		if err := checkLen(logger, 1, args); err != nil {
			return shim.Error(err.Error())
		}

		// unmarshal
		vote := new(ovote.Vote)
		err := json.Unmarshal([]byte(args[0]), vote)
		if err != nil {
			mes := fmt.Sprintf("failed to unmarshal Vote JSON: %s", err.Error())
			logger.Warning(mes)
			return shim.Error(mes)
		}

		err = this.AddVote(stub, vote)
		if err != nil {
			return shim.Error(err.Error())
		}

		// returns a success value
		return shim.Success([]byte{})

		// lists Votes
	case "ListVotes":
		votes, err := this.ListVotes(stub)
		if err != nil {
			return shim.Error(err.Error())
		}

		// marshal
		b, err := json.Marshal(votes)
		if err != nil {
			mes := fmt.Sprintf("failed to marshal Votes: %s", err.Error())
			logger.Warning(mes)
			return shim.Error(mes)
		}

		// returns a success value
		return shim.Success(b)

	case "ListOwnerIdVotes":

		// unmarshal
		var owner string
		err := json.Unmarshal([]byte(args[0]), &owner)
		if err != nil {
			mes := fmt.Sprintf("failed to unmarshal the 1st argument: %s", err.Error())
			logger.Warning(mes)
			return shim.Error(mes)
		}

		votes, err := this.ListOwnerIdVotes(stub, owner)
		if err != nil {
			return shim.Error(err.Error())
		}

		// marshal
		b, err := json.Marshal(votes)
		if err != nil {
			mes := fmt.Sprintf("failed to marshal Cars: %s", err.Error())
			logger.Warning(mes)
			return shim.Error(mes)
		}

		// returns a success value
		return shim.Success(b)

		// gets an existing Vote
	case "GetVote":
		// checks arguments length
		if err := checkLen(logger, 1, args); err != nil {
			return shim.Error(err.Error())
		}

		// unmarshal
		var id string
		err := json.Unmarshal([]byte(args[0]), &id)
		if err != nil {
			mes := fmt.Sprintf("failed to unmarshal the 1st argument: %s", err.Error())
			logger.Warning(mes)
			return shim.Error(mes)
		}

		vote, err := this.GetVote(stub, id)
		if err != nil {
			return shim.Error(err.Error())
		}

		// marshal
		b, err := json.Marshal(vote)
		if err != nil {
			mes := fmt.Sprintf("failed to marshal Vote: %s", err.Error())
			logger.Warning(mes)
			return shim.Error(mes)
		}

		// returns a success value
		return shim.Success(b)
	}

	// if the function name is unknown
	mes := fmt.Sprintf("Unknown method: %s", fcn)
	logger.Warning(mes)
	return shim.Error(mes)
}

//
// methods implementing OVote interface
//

// Adds a new Owner
func (this *OVoteCC) AddOwner(stub shim.ChaincodeStubInterface,
	owner *ovote.Owner) error {
	logger := shim.NewLogger("ovote")
	logger.Infof("AddOwner: Id = %s", owner.Id)

	// checks if the specified Owner exists
	found, err := this.CheckOwner(stub, owner.Id)
	if err != nil {
		return err
	}
	if found {
		mes := fmt.Sprintf("an Owner with Id = %s alerady exists", owner.Id)
		logger.Warning(mes)
		return errors.New(mes)
	}

	// converts to JSON
	b, err := json.Marshal(owner)
	if err != nil {
		logger.Warning(err.Error())
		return err
	}

	// creates a composite key
	key, err := stub.CreateCompositeKey("Owner", []string{owner.Id})
	if err != nil {
		logger.Warning(err.Error())
		return err
	}

	// stores to the State DB
	err = stub.PutState(key, b)
	if err != nil {
		logger.Warning(err.Error())
		return err
	}

	// returns successfully
	return nil
}

// Checks existence of the specified Owner
func (this *OVoteCC) CheckOwner(stub shim.ChaincodeStubInterface,
	id string) (bool, error) {
	logger := shim.NewLogger("ovote")
	logger.Infof("CheckOwner: Id = %s", id)

	// creates a composite key
	key, err := stub.CreateCompositeKey("Owner", []string{id})
	if err != nil {
		logger.Warning(err.Error())
		return false, err
	}

	// loads from the State DB
	jsonBytes, err := stub.GetState(key)
	if err != nil {
		logger.Warning(err.Error())
		return false, err
	}

	// returns successfully
	return jsonBytes != nil, nil
}

// Lists Owners
func (this *OVoteCC) ListOwners(stub shim.ChaincodeStubInterface) ([]*ovote.Owner,
	error) {
	logger := shim.NewLogger("ovote")
	logger.Info("ListOwners")

	// executes a range query, which returns an iterator
	iter, err := stub.GetStateByPartialCompositeKey("Owner", []string{})
	if err != nil {
		logger.Warning(err.Error())
		return nil, err
	}

	// will close the iterator when returned from this method
	defer iter.Close()
	owners := []*ovote.Owner{}

	// loops over the iterator
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			logger.Warning(err.Error())
			return nil, err
		}
		owner := new(ovote.Owner)
		err = json.Unmarshal(kv.Value, owner)
		if err != nil {
			logger.Warning(err.Error())
			return nil, err
		}
		owners = append(owners, owner)
	}

	// returns successfully
	if len(owners) > 1 {
		logger.Infof("%d %s found", len(owners), inflection.Plural("Owner"))
	} else {
		logger.Infof("%d %s found", len(owners), "Owner")
	}
	return owners, nil
}

// Adds a new Vote
func (this *OVoteCC) AddVote(stub shim.ChaincodeStubInterface,
	vote *ovote.Vote) error {
	logger := shim.NewLogger("ovote")
	logger.Infof("AddVote: HId = %s", vote.HId)

	// creates a composite key
	key, err := stub.CreateCompositeKey("Vote", []string{vote.HId})
	if err != nil {
		logger.Warning(err.Error())
		return err
	}

	// checks if the specified Vote exists
	found, err := this.CheckVote(stub, vote.HId)
	if err != nil {
		logger.Warning(err.Error())
		return err
	}
	if found {
		mes := fmt.Sprintf("Vote with HId = %s already exists", vote.HId)
		logger.Warning(mes)
		return errors.New(mes)
	}

	// validates the Vote
	ok, err := this.ValidateVote(stub, vote)
	if err != nil {
		logger.Warning(err.Error())
		return err
	}
	if !ok {
		mes := "Validation of the Vote failed"
		logger.Warning(mes)
		return errors.New(mes)
	}

	// converts to JSON
	b, err := json.Marshal(vote)
	if err != nil {
		logger.Warning(err.Error())
		return err
	}

	// stores to the State DB
	err = stub.PutState(key, b)
	if err != nil {
		logger.Warning(err.Error())
		return err
	}

	// returns successfully
	return nil
}

// Checks existence of the specified Vote
func (this *OVoteCC) CheckVote(stub shim.ChaincodeStubInterface, id string) (bool,
	error) {
	logger := shim.NewLogger("ovote")
	logger.Infof("CheckVote: Id = %s", id)

	// creates a composite key
	key, err := stub.CreateCompositeKey("Vote", []string{id})
	if err != nil {
		logger.Warning(err.Error())
		return false, err
	}

	// loads from the State DB
	jsonBytes, err := stub.GetState(key)
	if err != nil {
		logger.Warning(err.Error())
		return false, err
	}

	// returns successfully
	return jsonBytes != nil, nil
}

// Validates the content of the specified Vote
func (this *OVoteCC) ValidateVote(stub shim.ChaincodeStubInterface,
	vote *ovote.Vote) (bool, error) {
	logger := shim.NewLogger("ovote")
	logger.Infof("ValidateVote: HId = %s", vote.HId)

	// checks existence of the Owner with the OwnerId
	found, err := this.CheckOwner(stub, vote.OwnerId)
	if err != nil {
		logger.Warning(err.Error())
		return false, err
	}

	// returns successfully
	return found, nil
}

// Gets the specified Vote
func (this *OVoteCC) GetVote(stub shim.ChaincodeStubInterface,
	id string) (*ovote.Vote, error) {
	logger := shim.NewLogger("ovote")
	logger.Infof("GetVote: Id = %s", id)

	// creates a composite key
	key, err := stub.CreateCompositeKey("Vote", []string{id})
	if err != nil {
		logger.Warning(err.Error())
		return nil, err
	}

	// loads from the state DB
	jsonBytes, err := stub.GetState(key)
	if err != nil {
		logger.Warning(err.Error())
		return nil, err
	}
	if jsonBytes == nil {
		mes := fmt.Sprintf("Vote with Id = %s was not found", id)
		logger.Warning(mes)
		return nil, errors.New(mes)
	}

	// unmarshal
	vote := new(ovote.Vote)
	err = json.Unmarshal(jsonBytes, vote)
	if err != nil {
		logger.Warning(err.Error())
		return nil, err
	}

	// returns successfully
	return vote, nil
}

// Lists Cars
func (this *OVoteCC) ListVotes(stub shim.ChaincodeStubInterface) ([]*ovote.Vote,
	error) {
	logger := shim.NewLogger("ovote")
	logger.Info("ListVotes")

	// executes a range query, which returns an iterator
	iter, err := stub.GetStateByPartialCompositeKey("Vote", []string{})
	if err != nil {
		logger.Warning(err.Error())
		return nil, err
	}

	// will close the iterator when returned from this method
	defer iter.Close()

	// loops over the iterator
	votes := []*ovote.Vote{}
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			logger.Warning(err.Error())
			return nil, err
		}
		vote := new(ovote.Vote)
		err = json.Unmarshal(kv.Value, vote)
		if err != nil {
			logger.Warning(err.Error())
			return nil, err
		}
		votes = append(votes, vote)
	}

	// returns successfully
	if len(votes) > 1 {
		logger.Infof("%d %s found", len(votes), inflection.Plural("Vote"))
	} else {
		logger.Infof("%d %s found", len(votes), "Vote")
	}
	return votes, nil
}

// Lists OwnerId Votes
func (this *OVoteCC) ListOwnerIdVotes(stub shim.ChaincodeStubInterface, ownerId string) ([]*ovote.Vote,
	error) {
	logger := shim.NewLogger("ovote")
	logger.Info("ListOwnerIdVotes")

	// executes a range query, which returns an iterator
	iter, err := stub.GetStateByPartialCompositeKey("Vote", []string{})
	if err != nil {
		logger.Warning(err.Error())
		return nil, err
	}

	// will close the iterator when returned from this method
	defer iter.Close()

	// loops over the iterator
	votes := []*ovote.Vote{}
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			logger.Warning(err.Error())
			return nil, err
		}
		vote := new(ovote.Vote)
		err = json.Unmarshal(kv.Value, vote)
		if err != nil {
			logger.Warning(err.Error())
			return nil, err
		}
		if strings.Index(ownerId, "admin") != -1 {
			votes = append(votes, vote)
		} else {
			if vote.OwnerId == ownerId {
				votes = append(votes, vote)
			}

		}

	}

	// returns successfully
	if len(votes) > 1 {
		logger.Infof("%d %s found", len(votes), inflection.Plural("Vote"))
	} else {
		logger.Infof("%d %s found", len(votes), "Vote")
	}
	return votes, nil
}
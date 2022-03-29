package main

import (
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	"ovote/chaincode"
	"ovote"
)

func main() {
	//interface check
	var _ ovote.OVote = (*chaincode.OVoteCC)(nil)
	err := shim.Start(new(chaincode.OVoteCC))
	if err != nil {
		fmt.Printf("Error in chaincode process: %s", err)
	}
}

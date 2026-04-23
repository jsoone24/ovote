package main

import "testing"

func mkAgenda() *Agenda {
	return &Agenda{
		Id:          "00000000-0000-4000-8000-000000000000",
		Title:       "Q2 Election",
		Description: "Annual board seat",
		OpenAt:      "2026-05-01T00:00:00Z",
		CloseAt:     "2026-05-02T00:00:00Z",
		Options: []AgendaOption{
			{Id: "alice", Label: "Alice"},
			{Id: "bob", Label: "Bob"},
		},
		Key: AgendaKey{
			GroupPk:   "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
			Threshold: 2,
			N:         3,
			Trustees: []TrusteePublicShare{
				{Index: 1, Pk: "AAAA"},
				{Index: 2, Pk: "BBBB"},
				{Index: 3, Pk: "CCCC"},
			},
		},
		RegistrarBlindPk: "ZZZZ",
	}
}

func TestValidateAgenda_ok(t *testing.T) {
	if err := validateAgenda(mkAgenda()); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestValidateAgenda_thresholdOverN(t *testing.T) {
	a := mkAgenda()
	a.Key.Threshold = 4
	if err := validateAgenda(a); err == nil {
		t.Fatalf("expected error for threshold>n")
	}
}

func TestValidateAgenda_duplicateOptionIds(t *testing.T) {
	a := mkAgenda()
	a.Options[1].Id = "alice"
	if err := validateAgenda(a); err == nil {
		t.Fatalf("expected error for dup option id")
	}
}

func TestValidateAgenda_timeWindow(t *testing.T) {
	a := mkAgenda()
	a.CloseAt = a.OpenAt
	if err := validateAgenda(a); err == nil {
		t.Fatalf("expected error for non-positive window")
	}
}

func TestValidateAgenda_nonUuid(t *testing.T) {
	a := mkAgenda()
	a.Id = "not-a-uuid"
	if err := validateAgenda(a); err == nil {
		t.Fatalf("expected error for non-uuid id")
	}
}

func TestValidateAgenda_trusteeCountMismatch(t *testing.T) {
	a := mkAgenda()
	a.Key.N = 4
	if err := validateAgenda(a); err == nil {
		t.Fatalf("expected error for trustees length != n")
	}
}

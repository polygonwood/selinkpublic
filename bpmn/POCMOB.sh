#!/bin/bash
zbctl deploy ./SOP\ COSPAS\ SARSAT.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./Intake\ COSPAS\ SARSAT.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./Analysis\ COSPAS\ SARSAT.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./Action\ COSPAS\ SARSAT.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./Closure\ COSPAS\ SARSAT.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./SOP\ MOB.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./Intake\ MOB.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./Analysis\ MOB.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./Action\ MOB.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./Closure\ MOB.bpmn --insecure --address=10.10.20.41:26500
zbctl deploy ./SOP\ MEDEVAC.bpmn --insecure --address=10.10.20.41:26500

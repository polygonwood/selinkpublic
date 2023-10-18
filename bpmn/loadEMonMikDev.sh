#!/bin/bash
zbctl deploy ./SOP\ Emergency\ Call.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./Intake\ Emergency\ Call.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./Analysis\ Emergency\ Call.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./Action\ Emergency\ Call.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./Closure\ Emergency\ Call.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./SOP\ Missing\ Vessel.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./Intake\ Missing\ Vessel.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./Analysis\ Missing\ Vessel.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./Action\ Missing\ Vessel.bpmn --insecure --address=192.168.21.50:26500
zbctl deploy ./Closure\ Missing\ Vessel.bpmn --insecure --address=192.168.21.50:26500

#!/bin/bash
#
# Install into the specified appdaemon root folder
# Usage: cmd <app daemon root path>

if [[ "$1" == "" ]]; then echo "App dameon root path must be specified"; fi

# Create the custom_widgets folder if needed
mkdir -p $1/custom_widgets

# Copy widget files
cp -r weatherentity.yaml base_weatherentity $1/custom_widgets/

echo "Widget installed in $1/custom_widgets/"


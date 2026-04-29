#!/bin/sh
cd /Users/fuzeelogik/sidekick/Penny && npx tsc --noEmit --pretty 2>&1 | head -50
echo "Exit: $?"

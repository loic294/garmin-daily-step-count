# Garmin Daily Step Count Notification

Merge the power of Azure Functions and IFTTT to solve one of Garmin's most annoying missing features: no notifications when a daily step goal is incomplete.

## What this does?

This script is for the Azure Function. It's configured to check your step progress every 30 minutes and send a webhook call to IFTT if you fall behind.

## Features

- Check your daily step progress every 30 minutes
- Increase the frequency of the notification as the day nears the end
- Send an additional webhook call in the last hours of the day

## How I use it

## Todo

- [ ] Write getting started guide
- [ ] Make the notifications hours customizable
- [ ] Query the daily step goal from Garmin
- [ ] Publish the IFTTT templates

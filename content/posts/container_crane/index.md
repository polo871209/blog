---
draft: true
title: "Crane: Container Registry Swiss Army Knife"
date: 2025-09-08
lastmod: 2025-09-08
description: "Learn how Google's crane CLI tool enables remote container image manipulation without Docker, including copying images between registries and adding layers directly to remote repositories."
summary: "Explore crane, Google's lightweight CLI for remote container registry operations. Manipulate images, copy between registries, and add layers without local Docker pulls."
tags: ["containers", "docker", "registry", "cli", "google", "crane", "devops"]
---

## TL;DR

Google's `crane` is a lightweight CLI tool for interacting with container registries remotely. This allows you to mutate images without pulling them to localhost - even adding layers directly to remote registries. Perfect for CI/CD workflows where you need fast, efficient image operations without the overhead of local Docker pulls.

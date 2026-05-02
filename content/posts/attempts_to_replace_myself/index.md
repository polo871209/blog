---
title: "I attempted to replace myself and found it successful"
date: 2026-05-02
lastmod: 2026-05-02
summary: "Reflection of my career, you may find it TMI"
---

## WHY

Yes, why would I even do that.

It started when I saw OpenCode is [exploring 2.0](https://github.com/anomalyco/opencode/tree/2.0) to replace 1.0. You use the tool to build a better version of the tool to replace the tool. That's when it struck me, if a tool can replace itself, what about me? And yes, I am 100% replaceable, I will explain that later in more detail.

Replacing myself was not my intention. I was browsing Github Trending as usual, and a deep dive into one of the projects there is what actually started this journey.

## OpenSRE

If you don't know about my job, I am a Site Reliability Engineer, SRE in short, with around 4 years of experience. It is a role you usually only need when a company grows to a size and needs someone to manage infrastructure at scale, that's how I see my role. It's a role people usually find boring? We manage observability to make improvements in resources, architecture, set up rules and help developers' lives easier. I love it, it's such a fulfilling thing to build and improve the system day by day. One would never notice we exist, it is subtle and usually people expect things to work. I do the same too, when a website is unavailable, I question.

[OpenSRE](https://www.opensre.com/) is a recent project I find interesting, where they build an AI SRE agent. The concept is phenomenal, you can tell the people who have been building this are highly experienced and thoughtful about how they respond to a real system failure. Even without really using it, you could learn a lot from the flow of collecting evidence, filtering and diagnosing, simply lovely.

It does fit into the current job workflow, but since it's an open source project, it tries to fit as many use cases as possible, collecting evidence from everywhere, and unavoidably it will start to bloat. So then I thought, why wouldn't I build my own version and only fit my own use case, that's when I started getting... worried.

## My Implementation

Disclaimer, I am not here to brag about oh I built something so good, no, it's a very sad claim of how in the past few months I find the AI capability is way beyond myself.

I reused the similar pattern from OpenSRE, vibe coded it and got a test version running. The result, works maybe too well, scaringly well. There was an incident last week where all services started complaining about connection to the database and I started looking for evidence to see why that was happening. While I started looking into it, I also let my Agent do the same and start investigating. Then yes, it found the root cause in less than 5 minutes and it was exactly what happened, the evidence, the diagnosis and the remediation were all CORRECT, there were some noise that it's not related but the overall direction is correct. Though this is exactly what I am trying to achieve, but man, this is really alarming. This would've taken me half a day and I may not have found the issue or even given out a wrong conclusion.

## Reflection

I could convince myself and say it still needs us to validate, or AI still makes mistakes. That is a valid claim and in my current role I can confidently say it still needs my expertise to improve the overall stability. However, we need so much less effort to do our job, not only does this mean we no longer require so many SREs, but also all the fun and fulfillment of being an SRE.

I love this role, but like when I loved being a scuba instructor 5 years ago, I don't know when I will suddenly lose the chance of keep doing this again. I don't think this is so very close yet, but back then I was 23 and I had all the time and passion. Now I need to think maturely, carefully.

If you are reading until here, cheers. It is fun to write an article without AI.

## References

- Tracer-Cloud. (n.d.). _opensre_ [Computer software]. GitHub. https://github.com/Tracer-Cloud/opensre
- sst. (n.d.). _opencode_ [Computer software]. GitHub. https://github.com/sst/opencode
- polo871209. (n.d.). _opsremedy_ [Computer software]. GitHub. https://github.com/polo871209/opsremedy

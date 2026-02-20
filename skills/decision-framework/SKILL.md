---
name: decision-framework
description: Structured multi-model deliberation for big life decisions (Denver vs Taiwan, what to build, etc.)
---

Help me think through a big life decision using structured deliberation and multiple AI perspectives.

## Step 1: Define the Decision

Ask me: "What decision are you wrestling with?"

If I don't specify, check working memory and pillar data for known open decisions:
- Call `get_working_memory` (context section)
- Call `get_pillars` for current reality assessments
- Call `get_curiosities` for what_if type items

Suggest the most pressing open decision based on the data.

## Step 2: Map the Decision Space

Once the decision is identified, help me map it:

**Options**: List all options (not just binary — look for creative third/fourth options I haven't considered)

**Criteria**: What actually matters to me? Pull from working memory values section. Suggest criteria like:
- Aliveness score (which option makes me feel more alive?)
- Social connection potential
- Financial impact (use `get_finance_net_worth` for current position)
- Freedom/mobility impact
- Alignment with pillar visions
- Reversibility (can I undo this if it's wrong?)
- Experimentation potential (can I test this cheaply?)

**Constraints**: What are real constraints vs assumed ones? Challenge any constraint that might be self-imposed.

Present this as a clear decision map.

## Step 3: Multi-Model Perspectives

Use zen `consensus` tool:
"A person is deciding between these options: [options]. Their values are: [values from working memory]. Their current situation is: [context from working memory]. Their life pillar ratings are: [pulse data].

For each option:
1. What's the best realistic outcome in 6 months?
2. What's the worst realistic outcome in 6 months?
3. What would they regret NOT trying?
4. What are they afraid of with this option (spoken and unspoken)?
5. Rate each option 1-10 on: aliveness, financial health, social connection, freedom, growth.

Give different perspectives — don't converge on a single answer."

## Step 4: The Regret Test

Use zen `thinkdeep` tool:
"Imagine this person is 80 years old looking back. For each option: what would they regret? What would they be grateful for? Which version of the story would they want to tell?"

Present the regret analysis. This cuts through analysis paralysis because it taps emotion, not logic.

## Step 5: Experiment Design

The goal is NOT to make a permanent decision. It's to design the SMALLEST EXPERIMENT that gives maximum information.

For each viable option, propose:
- **The 2-week experiment**: What could you try for 2 weeks to test this?
- **The 3-month pilot**: What would a reversible trial look like?
- **The signal to watch**: What data would tell you this is working or not?
- **The exit ramp**: How do you reverse this if it's wrong?

## Step 6: Commit to an Experiment

Ask: "Which experiment are you willing to run? Not which decision to make forever — which experiment to start THIS WEEK?"

Create a coaching action item with `create_coaching_action_item` for the chosen experiment.

If this relates to a curiosity, update it with `update_curiosity` to status "exploring".

Save key insights to `create_ai_convo_summary` and update `update_working_memory` context section with the decision status.

## Style Notes
- Don't let me stay in analysis mode. The whole point is to move toward action.
- Challenge binary thinking ("Denver OR Taiwan" — what about both? What about neither? What about somewhere else?)
- Use financial data to ground the conversation ("you have 40 months runway — you CAN afford to experiment")
- Flag when I'm optimizing for comfort vs aliveness
- The best decision is often the most reversible one, not the optimal one

# Agent Handling Map - Task Assignment & Routing

## Overview

This document defines which agents handle which tasks, their responsibilities, and the approval flow for human-in-the-loop tasks.

---

## Sales Department (4 Active Tasks)

### 1. **Sales Agent** (📈 General)

**ID:** `1`  
**Specialization:** General Sales  
**Performance:** 87% Conversion Rate  
**Tasks:** 3 assigned  
**Availability:** Mon-Fri, 9 AM - 6 PM

#### Handled Tasks:

- ✅ **Task #1: Follow up with leads** (URGENT - Your Turn)
  - Role: Lead management and prospect contact
  - Action Flow: AI prepares list → Human reviews → Human makes calls
  - Timeline: 4 steps total, currently at step 2
  - Impact: +35% conversion rate

- ✅ **Task #2: Update CRM records** (TODAY - Completed)
  - Role: Data logging and CRM maintenance
  - Action Flow: AI automated entry → Human verified accuracy
  - Status: COMPLETED

- ✅ **Task #3: Review sales pipeline** (TODAY - Your Turn)
  - Role: Deal analysis and forecasting
  - Action Flow: AI analyzes deals → Human decides next actions
  - Timeline: 3 steps total, currently at step 1
  - Impact: Prevents deal slippage

---

### 2. **Sales Manager** (👔 Management)

**ID:** `1a`  
**Specialization:** Sales Management & Strategy  
**Performance:** 89% Pipeline Health  
**Tasks:** 2 assigned  
**Availability:** Mon-Fri, 9 AM - 6 PM  
**Parent Agent:** Sales (1)

#### Handled Tasks:

- ✅ **Task #21: Review sales performance** (THIS WEEK - AI Working)
  - Role: Team performance analysis and resource allocation
  - Action Flow: AI analyzes interactions → Human reviews and approves allocation
  - Timeline: 4 steps total, currently at step 2
  - Impact: +18% close rate, accelerate pipeline

- ✅ **Task #22: Set team targets** (THIS WEEK - Your Turn)
  - Role: Target setting and goal definition
  - Action Flow: AI calculates targets → Human finalizes and communicates
  - Timeline: 3 steps total, currently at step 1
  - Impact: Q1 target $2.5M revenue (+15% YoY)

---

### 3. **Sales Operations** (⚙️📊 Operations)

**ID:** `1b`  
**Specialization:** Operations & Analytics  
**Performance:** 91% Process Efficiency  
**Tasks:** 2 assigned  
**Availability:** Mon-Fri, 8 AM - 5 PM  
**Parent Agent:** Sales (1)

#### Handled Tasks:

- ✅ **Task #23: Audit CRM data quality** (URGENT - AI Working)
  - Role: Data quality assurance and validation
  - Action Flow: AI scans records → Human reviews discrepancies → Human approves cleanup
  - Timeline: 3 steps total, currently at step 2
  - Impact: Maintain 98%+ data accuracy

- ✅ **Task #24: Generate sales reports** (WEEKLY - Completed)
  - Role: Report generation and insights
  - Action Flow: AI generates 8 reports → Human reviews and distributes
  - Status: COMPLETED
  - Impact: Improved sales visibility

---

## Support Department

### **Support Agent** (🎧 General)

**ID:** `2`  
**Specialization:** Customer Support  
**Performance:** 94% Resolution Time  
**Tasks:** 3 assigned  
**Availability:** Mon-Sun, 24/7

#### Handled Tasks:

- ✅ **Task #6: Process support tickets** (URGENT - AI Working)
  - Role: Ticket routing and resolution
  - Action Flow: AI routes → AI resolves 8 → Human handles 2 complex escalations
  - Timeline: 4 steps total, currently at step 2

- ✅ **Task #7: Update ticket status** (TODAY - Completed)
  - Role: Customer communication and updates
  - Action Flow: AI sends updates → Human verifies tone
  - Status: COMPLETED

- ✅ **Task #8: Monitor response times** (TODAY - Your Turn)
  - Role: SLA compliance and resource management
  - Action Flow: AI reports metrics → Human allocates resources
  - Timeline: 2 steps total, currently at step 1

---

## Technical Department

### **Technical Agent** (⚙️ Infrastructure)

**ID:** `3`  
**Specialization:** Infrastructure & Architecture  
**Performance:** 99% Uptime  
**Tasks:** 2 assigned  
**Availability:** Mon-Fri, 10 AM - 8 PM

#### Handled Tasks:

- ✅ **Task #11: Monitor system health** (URGENT - AI Working)
  - Role: 24/7 system monitoring
  - Action Flow: AI monitors continuously → Human only acts on alerts
  - Timeline: 3 steps total, currently at step 3
  - Impact: 99.99% uptime SLA

- ✅ **Task #12: Review error logs** (TODAY - Completed)
  - Role: Error analysis and pattern identification
  - Action Flow: AI scans logs → Human reviews and categorizes
  - Status: COMPLETED

---

## Billing Department

### **Billing Agent** (💼 Finance)

**ID:** `4`  
**Specialization:** Finance & Payments  
**Performance:** 98% Accuracy  
**Tasks:** 1 assigned  
**Availability:** Mon-Fri, 9 AM - 5 PM

#### Handled Tasks:

- ✅ **Task #16: Process invoices** (URGENT - AI Working)
  - Role: Invoice generation and payment processing
  - Action Flow: AI processes invoices → Human monitors receipts
  - Timeline: 3 steps total, currently at step 2
  - Impact: $187.5k cash flow this week

---

## Task Handling Rules

### Priority Levels

```
🔴 URGENT          → Handle immediately, high impact
🟡 TODAY           → Complete within business hours
⚪ THIS WEEK       → Complete within 7 days
```

### Task Status Flow

```
pending → ai-working → your-turn → completed
```

### Agent Selection Logic

#### For Sales Tasks:

1. **Lead & prospect work** → Sales Agent (1)
2. **Team management** → Sales Manager (1a)
3. **Process & reporting** → Sales Operations (1b)

#### For Support Tasks:

1. **Customer tickets** → Support Agent (2)
2. **SLA monitoring** → Support Agent (2)

#### For Technical Tasks:

1. **Infrastructure** → Technical Agent (3)
2. **System monitoring** → Technical Agent (3)

#### For Billing Tasks:

1. **Invoicing** → Billing Agent (4)
2. **Payments** → Billing Agent (4)

---

## Human Approval Flow

### When to Require Human Approval

1. **Strategic Decisions**
   - Setting targets (Sales Manager)
   - Resource allocation (Sales Manager)
   - Budget approval (Technical)

2. **Risk Mitigation**
   - Escalated support tickets (Support)
   - Security patches (Technical)
   - Billing disputes (Billing)

3. **Quality Assurance**
   - Data validation (Sales Operations)
   - CRM accuracy (Sales Operations)
   - Report verification (Sales Operations)

4. **Operational Actions**
   - Follow-up actions (Sales)
   - Customer communication tone (Support)
   - Invoice processing (Billing)

---

## Current Active Tasks Summary

| Task                     | Agent         | Status     | Steps | Priority     |
| ------------------------ | ------------- | ---------- | ----- | ------------ |
| Follow up with leads     | Sales         | Your Turn  | 2/4   | 🔴 URGENT    |
| Update CRM records       | Sales         | Completed  | 4/4   | ✅           |
| Review sales pipeline    | Sales         | Your Turn  | 1/3   | 🟡 TODAY     |
| Review sales performance | Sales Manager | AI Working | 2/4   | ⚪ THIS WEEK |
| Set team targets         | Sales Manager | Your Turn  | 1/3   | ⚪ THIS WEEK |
| Audit CRM data           | Sales Ops     | AI Working | 2/3   | 🔴 URGENT    |
| Generate reports         | Sales Ops     | Completed  | 4/4   | ✅           |
| Process tickets          | Support       | AI Working | 2/4   | 🔴 URGENT    |
| Update ticket status     | Support       | Completed  | 3/3   | ✅           |
| Monitor response times   | Support       | Your Turn  | 1/2   | 🟡 TODAY     |
| Monitor system health    | Technical     | AI Working | 3/3   | 🔴 URGENT    |
| Review error logs        | Technical     | Completed  | 4/4   | ✅           |
| Process invoices         | Billing       | AI Working | 2/3   | 🔴 URGENT    |

---

## Agent Distribution

```
Sales Department: 7 active tasks (4 showing in "Human Approval Pending")
├── Sales Agent (1)
│   ├── Task #1 (Your Turn)
│   ├── Task #2 (Completed)
│   └── Task #3 (Your Turn)
├── Sales Manager (1a)
│   ├── Task #21 (AI Working)
│   └── Task #22 (Your Turn)
└── Sales Operations (1b)
    ├── Task #23 (AI Working)
    └── Task #24 (Completed)

Support Department: 3 active tasks
└── Support Agent (2)
    ├── Task #6 (AI Working)
    ├── Task #7 (Completed)
    └── Task #8 (Your Turn)

Technical Department: 2 active tasks
└── Technical Agent (3)
    ├── Task #11 (AI Working)
    └── Task #12 (Completed)

Billing Department: 1 active task
└── Billing Agent (4)
    └── Task #16 (AI Working)

TOTAL: 13 active tasks across 5 agents
```

---

## Workflow Examples

### Example 1: Follow Up with Leads (Sales Agent)

```
Step 1: AI gathers lead data from CRM       [⏱️ 5m] ✓ Complete
Step 2: Prepare engagement history          [⏱️ 8m] ✓ Complete
Step 3: Human reviews lead priorities       [⏱️ 10m] ⚡ IN PROGRESS
Step 4: Human makes follow-up calls         [⏱️ 15m] ⏳ Pending
```

### Example 2: Set Team Targets (Sales Manager)

```
Step 1: Analyze historical data             [Pending]
Step 2: Calculate optimal targets           [Pending]
Step 3: Human finalizes targets             [Pending]
```

### Example 3: Audit CRM Data (Sales Operations)

```
Step 1: AI scans 500 records                [⏱️ 10m] ✓ Complete
Step 2: Generate audit report               [⏱️ 8m] ⚡ IN PROGRESS
Step 3: Human approves cleanup              [⏱️ 5m] ⏳ Pending
```

---

## Response Times by Agent

| Agent         | URGENT    | TODAY     | THIS WEEK         |
| ------------- | --------- | --------- | ----------------- |
| Sales         | 2-4 hours | 4-6 hours | Next business day |
| Sales Manager | 2-4 hours | 4-6 hours | Next business day |
| Sales Ops     | 1-2 hours | 2-4 hours | Same day          |
| Support       | 30 min    | 2-4 hours | Same day          |
| Technical     | 30 min    | 1-2 hours | Same day          |
| Billing       | 1-2 hours | 2-4 hours | Same day          |

---

## Escalation Path

```
Task Issue/Blocker
    ↓
Primary Agent analyzes
    ↓
If blocked → Escalate to Manager (if applicable)
    ↓
Sales Mgr / Support Lead / Tech Lead
    ↓
If still blocked → Escalate to Executive Review
    ↓
VP Sales / VP Support / VP Operations
```

---

## Notes

- **4 Active Sales Tasks** visible in "Human Approval Pending" state
- Sales department has **3 specialized roles** supporting each other
- All agents follow **human-in-the-loop** approval for critical decisions
- Timeline tracking enabled for all tasks to monitor progress
- Escalation paths clear for blocked or urgent issues

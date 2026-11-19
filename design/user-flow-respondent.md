# Respondent User Flow

![Respondent flow](user-flow-respondent.png)

```mermaid
flowchart TB
    subgraph G1 ["Entry"]
        direction TB
        sr1[" "] ~~~ cr1
        subgraph cr1 [" "]
            direction LR
            Step1["1 Open unique link - verify token"] --> CheckStatus{"Check link status"}
            CheckStatus -- Closed --> EndClosed["Survey closed"]
            CheckStatus -- Already done --> EndReopen["Already completed"]
        end
    end

    subgraph G2 ["Eligibility"]
        direction TB
        sr2[" "] ~~~ cr2
        subgraph cr2 [" "]
            direction LR
            Step2["2 Consent - review terms"] --> CheckConsent{"Consent given?"}
            CheckConsent -- No --> EndConsent["Not eligible - consent declined"]
            CheckConsent -- Yes --> Step3["3 Screening questions - eligibility rules"]
            Step3 -. Failed screening .-> EndScreen["Not eligible - failed screening"]
        end
    end

    subgraph G3 ["Survey"]
        direction TB
        sr3[" "] ~~~ cr3
        subgraph cr3 [" "]
            direction LR
            Step4["4 Survey questions - autosaved, Back and resume"] -. Quota full .-> EndQuota["Not eligible - quota full"]
        end
    end

    subgraph G4 ["Finish"]
        direction TB
        sr4[" "] ~~~ cr4
        subgraph cr4 [" "]
            direction LR
            Step5["5 Completed - response submitted"]
        end
    end

    G1 --> G2
    G2 --> G3
    G3 --> G4

    classDef screen fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0f172a;
    classDef decision fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#0f172a;
    classDef completed fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d;
    classDef rejected fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#991b1b;
    classDef closed fill:#f1f5f9,stroke:#64748b,stroke-width:2px,color:#334155;
    classDef repeat fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#581c87;
    classDef group fill:#ffffff,stroke:#cbd5e1,stroke-width:1px,color:#475569;
    classDef invisible fill:none,stroke:none,color:none;

    class Step1,Step2,Step3,Step4 screen;
    class CheckStatus,CheckConsent decision;
    class Step5 completed;
    class EndConsent,EndScreen,EndQuota rejected;
    class EndClosed closed;
    class EndReopen repeat;
    class G1,G2,G3,G4 group;
    class sr1,sr2,sr3,sr4,cr1,cr2,cr3,cr4 invisible;
```

*Legend: Blue boxes represent active survey screens, amber diamonds represent decision gates, green boxes represent successful completion, red boxes represent disqualification screens, grey boxes represent closed surveys, and purple boxes represent repeat access attempts. Thin bordered panels group related steps together.*

---

### What happens at each step

1. **Open unique link**: The respondent accesses their invite token link, and the system verifies study availability to route closed or previously completed respondents to their respective screens.
2. **Consent**: The respondent reviews terms of participation and submits consent; choosing No routes directly to the Not eligible screen.
3. **Screening questions**: The respondent answers eligibility questions, the session pins to the active questionnaire version, and failing screening rules routes to the Not eligible screen.
4. **Survey questions**: The respondent completes main questions while the system autosaves responses, maintains the answered question path for Back navigation, and evaluates quota caps.
5. **Completed**: The system locks the survey row in a transaction to verify capacity before marking completion, showing the Completed screen or routing to Not eligible if quotas filled.

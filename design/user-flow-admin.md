# Admin User Flow

![Admin flow](user-flow-admin.png)

```mermaid
flowchart TB
    subgraph G1 ["Sign in"]
        direction TB
        s1[" "] ~~~ c1
        subgraph c1 [" "]
            direction LR
            Step1["1 Login - enter email and password"] --> Step2["2 Survey list - view all surveys"]
        end
    end

    subgraph G2 ["Prepare survey"]
        direction TB
        s2[" "] ~~~ c2
        subgraph c2 [" "]
            direction LR
            Step3["3 Upload file - choose .txt"] --> Step4{"4 Check file - errors found?"}
            Step4 -- Yes --> ErrBox["Error list with line numbers"]
            Step3 <-. Fix and re-upload .- ErrBox
        end
    end

    subgraph G3 ["Test and approve"]
        direction TB
        s3[" "] ~~~ c3
        subgraph c3 [" "]
            direction LR
            Step5["5 Preview and test - answers not counted"] --> Step6["6 Approve - freezes version, goes Live"]
        end
    end

    subgraph G4 ["Run and report"]
        direction TB
        s4[" "] ~~~ c4
        subgraph c4 [" "]
            direction LR
            Step7["7 Live dashboard - counts and quotas"] --> Step8["8 Export - CSV or Excel"]
            Step7 -. Manage .-> SideClose["Close survey"]
            Step7 -. Distribute .-> SideLinks["Share invite links"]
        end
    end

    G1 --> G2
    G2 --> G3
    G3 --> G4

    classDef screen fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0f172a;
    classDef decision fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#0f172a;
    classDef sidebox fill:#f1f5f9,stroke:#64748b,stroke-width:2px,color:#334155;
    classDef errorbox fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#991b1b;
    classDef group fill:#ffffff,stroke:#cbd5e1,stroke-width:1px,color:#475569;
    classDef invisible fill:none,stroke:none,color:none;

    class Step1,Step2,Step3,Step5,Step6,Step7,Step8 screen;
    class Step4 decision;
    class SideClose,SideLinks sidebox;
    class ErrBox errorbox;
    class G1,G2,G3,G4 group;
    class s1,s2,s3,s4,c1,c2,c3,c4 invisible;
```

*Legend: Blue boxes represent primary admin screens, amber diamonds represent decision checks, red boxes represent syntax errors, and grey boxes represent operational side actions. Thin bordered panels group related steps together.*

---

### What happens at each step

1. **Login**: The administrator enters their email and password, and the system authenticates the user session against their role.
2. **Survey list**: The user views all surveys with project metrics, target quotas, and publication status.
3. **Upload file**: The user selects a plain text questionnaire file and submits it for validation.
4. **Check file**: The system validates syntax and structure; if errors are found, line numbers are displayed and the user returns to re-upload, otherwise the draft advances.
5. **Preview and test**: The user tests interactive logic in sandbox mode where submitted answers are flagged as test data and excluded from quota counts.
6. **Approve**: The user approves the draft, which freezes the active version immutably, initializes quotas, and publishes the survey to live status.
7. **Live dashboard**: The user monitors live survey metrics, response progress, quota distribution, and study completion limits.
8. **Export**: The user downloads final response datasets in CSV or Excel format with unified column schemas.

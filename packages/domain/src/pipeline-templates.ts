export interface PipelineStage {
  roleKey: string;
  label: string;
  goal: string;
  backstory: string;
  adapter: "openhands" | "passthrough" | "document" | "research" | "shell";
  sortOrder: number;
  enabled: boolean;
}

export interface PipelineTemplate {
  key: string;
  name: string;
  description: string;
  stages: PipelineStage[];
}

// Note: roleKey values must match the ProjectRoleKey DB enum:
// planner | architect | implementer | tester | coder | qa | reviewer | visual
// Labels convey the semantic role within each template's domain.

export const PIPELINE_TEMPLATES: Record<string, PipelineTemplate> = {
  software: {
    key: "software",
    name: "Software Development",
    description: "End-to-end software delivery: architecture, implementation, testing, and review.",
    stages: [
      {
        roleKey: "architect",
        label: "Architect",
        goal: "Define the system boundaries and the highest-risk dependencies.",
        backstory: "You map the shape of the work and reduce uncertainty before implementation starts.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      },
      {
        roleKey: "implementer",
        label: "Implementer",
        goal: "Plan the approach for the smallest shippable slice of the work.",
        backstory: "You define the strategy and execution plan that the coder will carry out.",
        adapter: "passthrough",
        sortOrder: 2,
        enabled: true
      },
      {
        roleKey: "tester",
        label: "Tester",
        goal: "Write test cases and acceptance tests based on the implementation plan before code is written.",
        backstory: "You define what success looks like with concrete tests, enabling test-driven development.",
        adapter: "openhands",
        sortOrder: 3,
        enabled: true
      },
      {
        roleKey: "coder",
        label: "Coder",
        goal: "Execute the implementation plan by writing, modifying, and testing code in the repository.",
        backstory: "Takes the implementer's plan and turns it into concrete file changes, commits, and verified output.",
        adapter: "openhands",
        sortOrder: 4,
        enabled: true
      },
      {
        roleKey: "qa",
        label: "QA",
        goal: "Verify the slice and surface regressions or missing coverage.",
        backstory: "You design checks and acceptance coverage that make the change trustworthy.",
        adapter: "passthrough",
        sortOrder: 5,
        enabled: true
      },
      {
        roleKey: "reviewer",
        label: "Reviewer",
        goal: "Review the work against the constitution and call out follow-up needs.",
        backstory: "You protect quality and ensure the plan is understandable to operators.",
        adapter: "passthrough",
        sortOrder: 6,
        enabled: true
      }
    ]
  },

  content: {
    key: "content",
    name: "Content & Writing",
    description: "Research-backed content production with editing, fact-checking, and publishing stages.",
    stages: [
      {
        roleKey: "architect",
        label: "Researcher",
        goal: "Gather source material, references, and background context for the content piece.",
        backstory: "You build the factual foundation that all other stages rely on.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      },
      {
        roleKey: "implementer",
        label: "Writer",
        goal: "Draft the content piece in full based on the research and brief.",
        backstory: "You turn raw material into a coherent, engaging piece of writing.",
        adapter: "passthrough",
        sortOrder: 2,
        enabled: true
      },
      {
        roleKey: "qa",
        label: "Editor",
        goal: "Improve clarity, structure, tone, and voice of the draft.",
        backstory: "You shape rough drafts into polished, publication-ready content.",
        adapter: "passthrough",
        sortOrder: 3,
        enabled: true
      },
      {
        roleKey: "tester",
        label: "Fact Checker",
        goal: "Verify all claims, statistics, and references in the content.",
        backstory: "You ensure the content is accurate and trustworthy before it reaches readers.",
        adapter: "passthrough",
        sortOrder: 4,
        enabled: true
      },
      {
        roleKey: "reviewer",
        label: "Publisher",
        goal: "Prepare and finalise the content for delivery to its target channel.",
        backstory: "You handle the final formatting, metadata, and handoff to distribution.",
        adapter: "passthrough",
        sortOrder: 5,
        enabled: true
      }
    ]
  },

  architecture: {
    key: "architecture",
    name: "Solution Architecture",
    description: "Structured discovery and design process leading to a reviewed, approved architecture proposal.",
    stages: [
      {
        roleKey: "architect",
        label: "Discovery",
        goal: "Understand the problem space, stakeholder needs, and current state.",
        backstory: "You surface constraints and opportunities before any solution is proposed.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      },
      {
        roleKey: "implementer",
        label: "Solution Architect",
        goal: "Design the target architecture and justify key decisions.",
        backstory: "You produce the definitive design that balances capability, cost, and risk.",
        adapter: "passthrough",
        sortOrder: 2,
        enabled: true
      },
      {
        roleKey: "coder",
        label: "Technical Writer",
        goal: "Document the architecture in a clear, reviewable format.",
        backstory: "You turn design decisions into documentation that stakeholders can act on.",
        adapter: "passthrough",
        sortOrder: 3,
        enabled: true
      },
      {
        roleKey: "qa",
        label: "Reviewer",
        goal: "Critique the architecture document and identify gaps or risks.",
        backstory: "You stress-test the design so issues are caught before approval.",
        adapter: "passthrough",
        sortOrder: 4,
        enabled: true
      },
      {
        roleKey: "reviewer",
        label: "Approver",
        goal: "Make the final go/no-go call and capture any conditions of approval.",
        backstory: "You provide the authoritative sign-off that allows the project to proceed.",
        adapter: "passthrough",
        sortOrder: 5,
        enabled: true
      }
    ]
  },

  research: {
    key: "research",
    name: "Research",
    description: "Rigorous question-driven research with synthesis and peer critique before publishing.",
    stages: [
      {
        roleKey: "architect",
        label: "Question Framer",
        goal: "Define the research question, scope, and success criteria.",
        backstory: "You ensure the investigation is answering the right question in the right way.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      },
      {
        roleKey: "implementer",
        label: "Investigator",
        goal: "Conduct the research, gather evidence, and document findings.",
        backstory: "You do the deep work of discovering, testing, and recording what is true.",
        adapter: "passthrough",
        sortOrder: 2,
        enabled: true
      },
      {
        roleKey: "coder",
        label: "Synthesiser",
        goal: "Integrate findings into a coherent narrative or model.",
        backstory: "You connect the dots across disparate evidence to produce insight.",
        adapter: "passthrough",
        sortOrder: 3,
        enabled: true
      },
      {
        roleKey: "qa",
        label: "Critic",
        goal: "Challenge the synthesis, identify weaknesses, and suggest improvements.",
        backstory: "You improve the rigour of the output by finding what the synthesiser missed.",
        adapter: "passthrough",
        sortOrder: 4,
        enabled: true
      },
      {
        roleKey: "reviewer",
        label: "Publisher",
        goal: "Package the research for its intended audience and channel.",
        backstory: "You ensure the work reaches its audience in the right form.",
        adapter: "passthrough",
        sortOrder: 5,
        enabled: true
      }
    ]
  },

  marketing: {
    key: "marketing",
    name: "Marketing",
    description: "Strategy-led campaign design through to reviewed, published marketing output.",
    stages: [
      {
        roleKey: "architect",
        label: "Strategist",
        goal: "Define the campaign strategy, target audience, and key messages.",
        backstory: "You set the direction that all other marketing work follows.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      },
      {
        roleKey: "implementer",
        label: "Copywriter",
        goal: "Write compelling copy aligned to the strategy and brand voice.",
        backstory: "You craft the words that move the audience to action.",
        adapter: "passthrough",
        sortOrder: 2,
        enabled: true
      },
      {
        roleKey: "visual",
        label: "Designer",
        goal: "Create or specify the visual assets that accompany the copy.",
        backstory: "You bring the visual dimension that makes the campaign memorable.",
        adapter: "passthrough",
        sortOrder: 3,
        enabled: true
      },
      {
        roleKey: "qa",
        label: "Reviewer",
        goal: "Assess the campaign against strategy, brand guidelines, and quality bar.",
        backstory: "You catch anything off-brand or off-message before it goes live.",
        adapter: "passthrough",
        sortOrder: 4,
        enabled: true
      },
      {
        roleKey: "reviewer",
        label: "Publisher",
        goal: "Schedule and distribute the campaign to the target channels.",
        backstory: "You handle the final push that puts the work in front of the audience.",
        adapter: "passthrough",
        sortOrder: 5,
        enabled: true
      }
    ]
  },

  legal: {
    key: "legal",
    name: "Legal & Compliance",
    description: "Structured legal analysis, drafting, review, and compliance sign-off workflow.",
    stages: [
      {
        roleKey: "architect",
        label: "Analyst",
        goal: "Analyse the legal context, applicable regulations, and risk landscape.",
        backstory: "You build the legal foundation before any drafting begins.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      },
      {
        roleKey: "implementer",
        label: "Drafter",
        goal: "Produce the initial legal document or advice based on the analysis.",
        backstory: "You turn legal understanding into precise, actionable language.",
        adapter: "passthrough",
        sortOrder: 2,
        enabled: true
      },
      {
        roleKey: "qa",
        label: "Reviewer",
        goal: "Review the draft for accuracy, completeness, and legal soundness.",
        backstory: "You catch errors and ambiguities before the document proceeds.",
        adapter: "passthrough",
        sortOrder: 3,
        enabled: true
      },
      {
        roleKey: "tester",
        label: "Compliance Officer",
        goal: "Verify the document meets all applicable regulatory requirements.",
        backstory: "You ensure the organisation stays on the right side of the rules.",
        adapter: "passthrough",
        sortOrder: 4,
        enabled: true
      },
      {
        roleKey: "reviewer",
        label: "Approver",
        goal: "Provide final authorisation for the document to be executed or published.",
        backstory: "You carry the authority needed to make the document official.",
        adapter: "passthrough",
        sortOrder: 5,
        enabled: true
      }
    ]
  },

  data: {
    key: "data",
    name: "Data Analysis",
    description: "Structured data collection, analysis, visualization, narrative, and review pipeline.",
    stages: [
      {
        roleKey: "architect",
        label: "Collector",
        goal: "Define the data sources, collection scope, and quality criteria.",
        backstory: "You establish what data is needed and how to gather it reliably.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      },
      {
        roleKey: "implementer",
        label: "Analyst",
        goal: "Process the collected data and surface patterns, trends, and insights.",
        backstory: "You turn raw data into structured findings through rigorous analysis.",
        adapter: "passthrough",
        sortOrder: 2,
        enabled: true
      },
      {
        roleKey: "visual",
        label: "Visualiser",
        goal: "Create charts, dashboards, and visual representations of the findings.",
        backstory: "You make the data legible and compelling through visual design.",
        adapter: "passthrough",
        sortOrder: 3,
        enabled: true
      },
      {
        roleKey: "coder",
        label: "Narrator",
        goal: "Write the interpretive narrative that gives the analysis meaning and context.",
        backstory: "You translate findings into a story that non-technical stakeholders can act on.",
        adapter: "passthrough",
        sortOrder: 4,
        enabled: true
      },
      {
        roleKey: "reviewer",
        label: "Reviewer",
        goal: "Review the analysis and narrative for accuracy, completeness, and clarity.",
        backstory: "You ensure the work is trustworthy and ready for its intended audience.",
        adapter: "passthrough",
        sortOrder: 5,
        enabled: true
      }
    ]
  },

  product: {
    key: "product",
    name: "Product",
    description: "Product discovery, design, engineering, QA, and stakeholder review pipeline.",
    stages: [
      {
        roleKey: "architect",
        label: "PM",
        goal: "Define the feature requirements, user story, and acceptance criteria.",
        backstory: "You translate user needs into a clear specification the team can build from.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      },
      {
        roleKey: "visual",
        label: "Designer",
        goal: "Produce wireframes, mockups, or design specs for the feature.",
        backstory: "You define how the feature looks and how users interact with it.",
        adapter: "passthrough",
        sortOrder: 2,
        enabled: true
      },
      {
        roleKey: "coder",
        label: "Engineer",
        goal: "Implement the feature to spec in the codebase.",
        backstory: "You build what was designed, writing clean and tested code.",
        adapter: "openhands",
        sortOrder: 3,
        enabled: true
      },
      {
        roleKey: "qa",
        label: "QA",
        goal: "Test the feature against acceptance criteria and surface regressions.",
        backstory: "You verify the feature works as intended before it reaches stakeholders.",
        adapter: "passthrough",
        sortOrder: 4,
        enabled: true
      },
      {
        roleKey: "reviewer",
        label: "Reviewer",
        goal: "Review the completed feature against the original requirements and quality bar.",
        backstory: "You give the final sign-off that the work is ready to ship.",
        adapter: "passthrough",
        sortOrder: 5,
        enabled: true
      }
    ]
  },

  custom: {
    key: "custom",
    name: "Custom",
    description: "Start with a single worker role and build your own pipeline after creation.",
    stages: [
      {
        roleKey: "implementer",
        label: "Worker",
        goal: "Complete the assigned task.",
        backstory: "You are a general-purpose agent ready to take on any work.",
        adapter: "passthrough",
        sortOrder: 1,
        enabled: true
      }
    ]
  }
};

export const PIPELINE_TEMPLATE_KEYS = Object.keys(PIPELINE_TEMPLATES) as Array<keyof typeof PIPELINE_TEMPLATES>;

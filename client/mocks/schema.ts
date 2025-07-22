// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 33,
    "userId": 70,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 74,
    "userId": 31,
    "expires": "2025-07-22T03:46:32.376Z"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "jwme03lx-3g6h-ddk7-rnc5-29962xe4kjn",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 40,
    "name": "Admin User"
  },
  {
    "id": 90,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-22T03:46:32.376Z"
  },
  {
    "id": 96,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-22T03:46:32.376Z"
  },
  {
    "id": 6,
    "name": "TA User"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "ku5n1n2q-p2m0-do4v-mmx7-7d4s56o1brv",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "userId": 40,
    "lastLogin": "2025-07-22T03:46:32.376Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true
  },
  {
    "id": "0q9g4l3l-zi58-jn24-kgjj-vzzvatlfy6",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "userId": 90,
    "lastLogin": "2025-07-22T03:46:32.376Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false
  },
  {
    "id": "115qucb0-ysov-hdkm-c9wh-vuvqe1yhs8e",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "lastLogin": "2025-07-22T03:46:32.376Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "userId": 96
  },
  {
    "id": "uqx261pg-33qu-318w-zgqh-wpiiend1gw",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "lastLogin": "2025-07-22T03:46:32.376Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "userId": 6
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "132ly2u2-2nkg-8tab-8cvr-cfsdm8zrzib",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "tbvyd04c-jc3t-soif-rz2v-pvh5b7k0hfg",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "5b3r0b2t-u0z1-pzby-i59z-d55c3cdvlxe",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 59,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "6tu454sy-g5zx-cfe4-jjjt-191ht4g1opl",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 13,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "0xs973mw-o3b7-4hph-p805-8hxgaqxodiu",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 64,
    "passPoints": "passPoints_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 64,
    "level": "level_1",
    "context": {}
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "m2u5lgy4-yn5h-5lhi-o0yi-4oxwvr19s15",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 88
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 11,
    "createdAt": "2025-07-22T03:46:32.376Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "s18f0ue2-dncd-q6w3-19ue-usx3tjoz7na",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "r77iyawu-u66v-1rv9-09ki-6qgwg98b3h6",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1"
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "v6guk9jr-5jd6-wpt5-tz3p-7dc4ghm91a3",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1"
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "l7ehrr38-vrk7-lwk9-c842-m2v8xz5auo",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "ocwciz0s-qaua-qqm8-1r8s-c1gy747gvg",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "profileId": "profileId_1",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "r25jofs7-bcdp-dylc-l64r-xo3cddb7wbe",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.81,
    "defaultAgent": "defaultAgent_1",
    "color": "color_1",
    "modelId": "modelId_1"
  },
  {
    "id": "gbzz9ok5-9ddt-wjm5-hksc-vb7dirt1u8",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.54,
    "defaultAgent": "defaultAgent_2",
    "color": "color_2",
    "modelId": "modelId_2"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "tbbetj19-j57a-2rdn-02ot-vmuq323q64",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.27,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "obpls0pw-a26k-385e-keuq-vauvmo2e9af",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "crowdedness": 65,
    "intensity": 94,
    "classId": "classId_1",
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1"
  },
  {
    "id": "847s4krn-4c6h-to9y-0boq-z0fy9aflkwm",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "crowdedness": 5,
    "intensity": 51,
    "classId": "classId_2",
    "locationId": "locationId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2"
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "ov60hgkz-ybl9-e7ce-8lhh-kompt1ymydg",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "fis5xs1a-4v3v-8fzi-pvxd-c8760l45q1j",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "name": "Scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "963q9bvd-2za1-gil3-l875-8phalhobfip",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "deadline": "deadline_1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "ap6lew5v-jndi-kv7z-562c-2sjgagdh34s",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "timeOfDay": "timeOfDay_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "elgxk39b-5eh0-e5xw-8z6g-6skrdzcvm64",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "obpls0pw-a26k-385e-keuq-vauvmo2e9af",
      "847s4krn-4c6h-to9y-0boq-z0fy9aflkwm"
    ],
    "rubricId": "rubricId_1"
  },
  {
    "id": "qdnpkaqk-l4hj-634b-rjaf-qp1rnqmxbim",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "obpls0pw-a26k-385e-keuq-vauvmo2e9af",
      "847s4krn-4c6h-to9y-0boq-z0fy9aflkwm"
    ],
    "rubricId": "rubricId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "bv0zkz9w-hm6x-uj2e-z9yz-6ag980pd2xq",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "profileId": "profileId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "4kcs2kwz-pwoh-3zrh-1fii-u0szso7ap4k",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "completedAt": "2025-07-22T03:46:32.376Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "3nitok0l-8zlt-r5dx-a22z-64lnleqtb9j",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "yo0is1k5-s43k-dk1m-8bkr-bkcwt6lss7s",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "passed": false,
    "score": 24,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "o2bwpumr-beh8-bpnt-cy5b-x7erxyassut",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 36
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "jzq83c8i-z6we-agg6-vll7-70crlfbzoy8",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "ku5n1n2q-p2m0-do4v-mmx7-7d4s56o1brv",
      "0q9g4l3l-zi58-jn24-kgjj-vzzvatlfy6",
      "115qucb0-ysov-hdkm-c9wh-vuvqe1yhs8e",
      "uqx261pg-33qu-318w-zgqh-wpiiend1gw"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "f3ceu6dc-cr69-073m-ty8t-eqovvh67l45",
    "createdAt": "2025-07-22T03:46:32.376Z",
    "updatedAt": "2025-07-22T03:46:32.376Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "ku5n1n2q-p2m0-do4v-mmx7-7d4s56o1brv",
      "0q9g4l3l-zi58-jn24-kgjj-vzzvatlfy6",
      "115qucb0-ysov-hdkm-c9wh-vuvqe1yhs8e",
      "uqx261pg-33qu-318w-zgqh-wpiiend1gw"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-22T03:46:32.376Z"
  }
];


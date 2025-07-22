// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 67,
    "userId": 93,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 7,
    "idToken": "idToken_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 15,
    "userId": 51,
    "expires": "2025-07-22T13:36:07.089Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "myjmzml1-3os3-78gu-inog-8b32w3udie7",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 97,
    "email": "admin@example.com",
    "emailVerified": "2025-07-22T13:36:07.089Z",
    "image": "image_1"
  },
  {
    "id": 23,
    "name": "Instructional User",
    "emailVerified": "2025-07-22T13:36:07.089Z",
    "image": "image_2"
  },
  {
    "id": 23,
    "name": "Instructor User",
    "email": "instructor@example.com"
  },
  {
    "id": 51,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-22T13:36:07.089Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "ub0iiyt0-ozib-8vng-4tn3-bf8drqdxaei",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "lastLogin": "2025-07-22T13:36:07.089Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-22T13:36:07.089Z",
    "userId": 97
  },
  {
    "id": "0c46tzid-549r-zgz1-bwcd-gk4sra9qk3n",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "userId": 23,
    "lastLogin": "2025-07-22T13:36:07.089Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-22T13:36:07.089Z"
  },
  {
    "id": "nukgiryv-3kle-2q47-pcfi-4lue4i7agvb",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "userId": 23,
    "lastLogin": "2025-07-22T13:36:07.089Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-22T13:36:07.089Z"
  },
  {
    "id": "uw4gz3ka-vnmk-062h-wgei-ung16oxcqh",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "userId": 51,
    "lastLogin": "2025-07-22T13:36:07.089Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-22T13:36:07.089Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "vqcjrhep-knqe-rx95-3quo-3y5n57hs1yy",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "d080kw9b-1ioz-zoes-aa3q-jpqswbql4yb",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "xqpc00h7-yw5l-040w-bdgj-ereq7xda60q",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 22,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "bq7qrvsp-vqdk-8qn5-l3jy-0128hf1rdu9l",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 83,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "wuq3vd6v-9ag6-p6sq-lvlc-tdqcplg817o",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 51,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 9,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-22T13:36:07.089Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "msxw2ksz-gkqv-u22z-fp2v-i866e35t4fq",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 17,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 70,
    "createdAt": "2025-07-22T13:36:07.089Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "egi83qj3-p5ba-tenp-m4qe-9fvftbk9elq",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "5aibgh8z-iknx-g8su-zros-v4nbcfm2ymr",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "completedAt": "2025-07-22T13:36:07.089Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "t3yxf293-3zcz-vd1d-eswn-mokptv4m0eh",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "completedAt": "2025-07-22T13:36:07.089Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "8112ck99-dbl1-t3kf-v637-hahizr0xno",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "yvt7bigj-8v2x-1nns-6wxd-gvlje95r62",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
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
    "mainSplit": "mainSplit_1",
    "footerSplit": "footerSplit_1"
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "cguk1yke-ffz0-rmbs-ixes-dqw6871nevd",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.35,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "reasoning": "low"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "lr955f5s-ptct-2ak6-i49x-cdste93k4v8",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.14,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "k500dnfs-ris2-ghaz-ba3g-1axqfz6yhzm",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "crowdedness": 21,
    "deadlineId": "deadlineId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "j8a3tcuy-kh8o-9d5n-4qdm-1l75ag8pl5i",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "intensity": 81,
    "classId": "classId_2",
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true,
    "parentId": "parentId_2",
    "active": false
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "u6080lz8-5lid-wls5-v4l5-899dppuxgal",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1",
    "description": "Description for scenario_classes 1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "3fbggh08-7gtf-x6hm-483z-4xw701aa9ub",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "vhpgqzbn-qkfm-vrz3-1yh3-quqwdx1v3z",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "jmaiunwk-e8s6-pjfb-o3g4-4rac0vnmon",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "dq66q8dk-0gvc-agvb-23h2-9guvuipvpgt",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "k500dnfs-ris2-ghaz-ba3g-1axqfz6yhzm",
      "j8a3tcuy-kh8o-9d5n-4qdm-1l75ag8pl5i"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "749jh5fu-zlw0-muyu-29c3-5lk0c440wai",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "k500dnfs-ris2-ghaz-ba3g-1axqfz6yhzm",
      "j8a3tcuy-kh8o-9d5n-4qdm-1l75ag8pl5i"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "84k252i0-2g7o-8qvz-4d3g-pymrhy90fo",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "bolgu1ee-bo0t-td06-7ece-c4vqjhm5obu",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "completedAt": "2025-07-22T13:36:07.089Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "vdjwbwoa-549n-sgzq-r0qa-j1exlmdpscf",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "o6on1wih-m6tc-0ygk-la6h-wydv2i2b3l",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "passed": true,
    "score": 89,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "80enmvf6-f11g-gg2q-iinz-z9r2fy30qjb",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 47,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "f6uwoi84-3weo-1v0x-2gj4-sdpdf6lz55g",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "ub0iiyt0-ozib-8vng-4tn3-bf8drqdxaei",
      "0c46tzid-549r-zgz1-bwcd-gk4sra9qk3n",
      "nukgiryv-3kle-2q47-pcfi-4lue4i7agvb",
      "uw4gz3ka-vnmk-062h-wgei-ung16oxcqh"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "dq66q8dk-0gvc-agvb-23h2-9guvuipvpgt",
      "749jh5fu-zlw0-muyu-29c3-5lk0c440wai"
    ]
  },
  {
    "id": "4408uks3-jyx9-3xxv-mjzp-vi6b4mcntph",
    "createdAt": "2025-07-22T13:36:07.089Z",
    "updatedAt": "2025-07-22T13:36:07.089Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "ub0iiyt0-ozib-8vng-4tn3-bf8drqdxaei",
      "0c46tzid-549r-zgz1-bwcd-gk4sra9qk3n",
      "nukgiryv-3kle-2q47-pcfi-4lue4i7agvb",
      "uw4gz3ka-vnmk-062h-wgei-ung16oxcqh"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "dq66q8dk-0gvc-agvb-23h2-9guvuipvpgt",
      "749jh5fu-zlw0-muyu-29c3-5lk0c440wai"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-22T13:36:07.089Z",
    "token": "token_1"
  }
];


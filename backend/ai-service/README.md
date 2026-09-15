AI service boundary for recommendations, FAQs, summaries, and citations. The service groups assistant capabilities while keeping each capability's prompts, validation, provider calls, and response shaping in its own subfolder.

Responses should carry enough context for the frontend to distinguish generated text, citations, summaries, and recommendations. Provider failures, rate limits, unsafe or incomplete outputs, and prompt configuration should be handled consistently at this boundary.

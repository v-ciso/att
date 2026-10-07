export const careerSteps = [
  { title: 'Sales Rep', description: 'Master the offer, the pitch, and compliance.' },
  { title: 'Leader', description: 'Lead the floor and coach reps in real time.' },
  { title: 'Assistant Director/Manager', description: 'Hire, schedule, and take responsibility for office results.' },
  { title: 'Owner', description: 'Own and build your own market.' },
] as const;

export const onboardingSteps = [
  { period: 'Before orientation', title: 'Paperwork in', description: 'Return your signed offer, W-4, I-9, direct deposit details, and background consent. Training is paid. Complete your onboarding paperwork and check with your manager about payroll setup.', href: '/training#resources', link: 'Open new-hire resources' },
  { period: 'Week 1', title: 'Learn the offer', description: 'Read the Field Guide and Costco Promotions sheet. Go through every Brush Up guide. Keep doing Promo drill rounds until you score 11/12 or better three times in a row.', href: '/training/practice?drill=promo', link: 'Practice promotions' },
  { period: 'Week 2', title: 'Find your words', description: 'Practice your opener out loud until it feels natural. Pass the Pitch & Compliance drill at 11/12 or better. Shadow a Leader and run quotes on the trade-in tool with them.', href: '/training/practice?drill=pitch', link: 'Practice pitch & compliance' },
  { period: 'Weeks 3–4', title: 'Run it solo', description: 'Take your own conversations. Hit the daily targets you set with your manager. Track every shift on your scoreboard and talk through your numbers at the end of the day.', href: '/login', link: 'Open staff scoreboard' },
  { period: 'Days 30–90', title: 'Be consistent', description: 'Aim for zero chargebacks and clean order entry. Hit your targets week after week. Help train the next new hire. That consistency is what moves you toward Leader.', href: '/training/practice?drill=pitch&mode=study', link: 'Review the fundamentals' },
] as const;

export const dailyHabits = [
  { title: 'Show up prepared', description: 'Check Knowledge Plus and do one drill round before every shift.' },
  { title: 'Be accurate', description: 'Clean, correct orders protect the member, the client, and your reputation. An honest, complete conversation is the one that lasts.' },
  { title: 'One no and go', description: 'If a member says no, thank them and move on. Protecting the Costco relationship protects your job.' },
  { title: 'Get coached', description: 'Ask your Leader for feedback every day. The reps who move up fastest are the ones who ask.' },
] as const;

export const fieldLinks = [
  { title: 'AT&T Knowledge Plus', description: 'Current promotions and terms. Check every shift. Requires your SARA Plus login.', href: 'https://attknowledgeplus.com' },
  { title: 'Trade-in value', description: 'Check the live value of the member’s current phone.', href: 'https://tradein.att.com/' },
  { title: 'Coverage map', description: 'Look up coverage at the member’s home and work addresses.', href: 'https://www.att.com/maps/wireless-coverage.html' },
  { title: 'Quick Quote · Mobile Sales Tool', description: 'Build member quotes. Access steps are pinned in Discord.', href: 'https://mst.att.com/qq' },
  { title: 'Carrier Switcher', description: 'Submit the old carrier bill for the reward card. Verify current eligibility and deadlines.', href: 'https://www.att.com/switcherpayoff' },
  { title: 'Appreciation discounts', description: 'The training guide says to apply within 30 days of activation. Confirm current terms before advising a member.', href: 'https://www.att.com/appreciation' },
  { title: 'Track & activate', description: 'Have the order number (starting with 99-) and ZIP code ready.', href: 'https://www.att.com/checkmyorder' },
] as const;

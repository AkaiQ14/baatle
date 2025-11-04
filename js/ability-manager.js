class AbilityManager {
  static STORAGE_KEYS = {
    PLAYER1_ABILITIES: 'player1Abilities',
    PLAYER2_ABILITIES: 'player2Abilities',
    PLAYER1_USED_ABILITIES: 'player1UsedAbilities',
    PLAYER2_USED_ABILITIES: 'player2UsedAbilities',
    SAVED_ABILITIES: 'savedAbilities'
  };

  /**
   * Normalize ability to a consistent format
   * @param {string|object} ability 
   * @returns {object} Normalized ability object
   */
  static normalizeAbility(ability) {
    if (typeof ability === 'string') {
      return { text: ability, used: false };
    }
    return {
      text: ability.text || ability,
      used: ability.used || false
    };
  }

  /**
   * Load abilities for a specific player
   * @param {string} playerParam - 'player1' or 'player2'
   * @returns {Array} Normalized abilities
   */
  static loadPlayerAbilities(playerParam) {
    try {
      const abilitiesKey = `${playerParam}Abilities`;
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;

      const abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
      const usedAbilities = new Set(JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]'));

      return abilities.map(ability => {
        const normalizedAbility = this.normalizeAbility(ability);
        normalizedAbility.used = usedAbilities.has(normalizedAbility.text);
        return normalizedAbility;
      });
    } catch (error) {
      console.error(`Error loading abilities for ${playerParam}:`, error);
      return [];
    }
  }

  /**
   * Save abilities for a specific player
   * @param {string} playerParam - 'player1' or 'player2'
   * @param {Array} abilities - Abilities to save
   */
  static savePlayerAbilities(playerParam, abilities) {
    try {
      const normalizedAbilities = abilities.map(this.normalizeAbility);
      const usedAbilities = normalizedAbilities
        .filter(ability => ability.used)
        .map(ability => ability.text);

      localStorage.setItem(`${playerParam}Abilities`, JSON.stringify(normalizedAbilities));
      localStorage.setItem(`${playerParam}UsedAbilities`, JSON.stringify(usedAbilities));
    } catch (error) {
      console.error(`Error saving abilities for ${playerParam}:`, error);
    }
  }

  /**
   * Add a new ability for a player
   * @param {string} playerParam - 'player1' or 'player2'
   * @param {string} abilityText - Ability text to add
   */
  static addAbility(playerParam, abilityText) {
    const currentAbilities = this.loadPlayerAbilities(playerParam);
    const isDuplicate = currentAbilities.some(a => a.text === abilityText);

    if (!isDuplicate) {
      currentAbilities.push(this.normalizeAbility(abilityText));
      this.savePlayerAbilities(playerParam, currentAbilities);
    }
  }

  /**
   * Toggle ability usage
   * @param {string} playerParam - 'player1' or 'player2'
   * @param {string} abilityText - Ability to toggle
   */
  static toggleAbilityUsage(playerParam, abilityText) {
    const abilities = this.loadPlayerAbilities(playerParam);
    const updatedAbilities = abilities.map(ability => 
      ability.text === abilityText 
        ? { ...ability, used: !ability.used } 
        : ability
    );
    this.savePlayerAbilities(playerParam, updatedAbilities);
  }

  /**
   * Reset all abilities for a player
   * @param {string} playerParam - 'player1' or 'player2'
   */
  static resetAbilities(playerParam) {
    const abilities = this.loadPlayerAbilities(playerParam);
    const resetAbilities = abilities.map(ability => ({ ...ability, used: false }));
    this.savePlayerAbilities(playerParam, resetAbilities);
  }
}

// Export for use in other modules
export default AbilityManager;

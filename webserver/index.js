const axios = require('axios').default;
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const app = express()
app.use(cors())

let token = fs.readFileSync('token.txt')
let token_expiry = Date.now()
const session = fs.readFileSync('session.txt')
const characters = JSON.parse(fs.readFileSync('characterMap.json'))

/*function getTotalModifierValue(groupedModifiers, type, subType) {
    let modifiers = getModifiersByType(groupedModifiers, type, subType);
    modifiers = array_column(modifiers, 'value');
    return array_sum(modifiers);
}*/

function getConstitution(character) {
    let con = character.stats[2].value
    return Math.floor((con-10)/2)
}

function getIdFromName(characterName) {
    if (characters[characterName]) {
        return characters[characterName]
    }
    else return null
}

function calcMaxHp(character) {
    if (character.overrideHitPoints) {
        return character.overrideHitPoints;
      }
  
      let max_hp = 0;
      if (character.preferences.hitPointType) {
        //let bonus_per_level_hp = $this->dataModifier->getTotalModifierValue(character['modifiers'], 'bonus', 'hit-points-per-level');
        let bonus_per_level_hp = 0

        let con = getConstitution(character)
        //$con = $this->getStatMod(character, 'con');
  
        for (let cls of character.classes) {
          let hit_die = cls.definition.hitDice;
          let adjusted_level = cls.level;
  
          if (cls.isStartingClass) {
            max_hp += hit_die + con;
            adjusted_level--;
          }
  
          max_hp += (Math.ceil((hit_die / 2) + 1) + con) * adjusted_level + bonus_per_level_hp * cls.level;
        }
      }
      else {
        max_hp = character.baseHitPoints ?? 0;
      }
  
      max_hp += character.bonusHitPoints ?? 0;
  
      return max_hp;
}

async function getHp(characterId) {
    console.log("Getting hp")
    const t = await getToken()
    let res = await axios.get(`https://character-service.dndbeyond.com/character/v5/character/${characterId}`, {
        headers: {
            'Authorization': `Bearer ${t}`
        }
    })
    console.log(res.status)
    let data = res.data.data
    console.log(data.name)
    console.log(data.baseHitPoints)
    console.log(data.removedHitPoints)
    let maxhp = calcMaxHp(data)
    let currentHp = maxhp - data.removedHitPoints
    return {maxHp: maxhp, currentHp: currentHp, tempHp: data.temporaryHitPoints }
}

async function getToken() {
    if (Date.now() > token_expiry) {
        console.log("Getting new token")
        let res = await axios.post(`https://auth-service.dndbeyond.com/v1/cobalt-token`, {}, {
            withCredentials: true,
            headers: {
                Cookie: `CobaltSession=${session.toString()}; User.ID=100970159; User.Username=spjak; cobalt-token=${token.toString()}`
            }
        })
        token_expiry = Date.now() + res.data.ttl * 1000
        token = res.data.token
    }
    return token
}

app.get('/characters/:characterName/hp', async function (req, res) {
    let id = getIdFromName(req.params.characterName)
    if (id) {
        let hp = await getHp(id)
        res.send(hp)
    }
    else res.sendStatus(404)
})

app.listen(3000)

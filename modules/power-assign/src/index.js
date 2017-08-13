// @flow

import equal from 'deep-equal'
import QueryOperation from './query-operation'

import type { QueryCondition } from './query-operation'

type Restorable = Object
type DotNotationString = string
type SetOperator = { [field: DotNotationString]: any }
type IncOperator = { [field: DotNotationString]: number }
type MinOperator = { [field: DotNotationString]: any }
type MaxOperator = { [field: DotNotationString]: any }
type MulOperator = { [field: DotNotationString]: number }
type AddToSetOperator = { [field: DotNotationString]: any | { $each: Array<any> } }
type PopOperator = { [field: DotNotationString]: 1 | - 1 }

type PullOperator = { [field: DotNotationString]: any | QueryCondition }

type PushModifier = {
  $each: Array<any>,
  $slice?: number,
  $sort?: { [field: DotNotationString]: 1 | -1 },
  $position?: number,
}
type PushOperator = { [field: DotNotationString]: any | PushModifier }

type TypeSpecification = true | { $type: 'timestamp' | 'date' }
type CurrentDateOperator = { [field: DotNotationString]: TypeSpecification }
type BitOperator = {
  [field: DotNotationString]: {
    and?: number,
    or?: number,
    xor?: number,
  }
}

type Operators = $Shape<{
    $set: SetOperator,
    $inc: IncOperator,
    $min: MinOperator,
    $max: MaxOperator,
    $mul: MulOperator,
    $addToSet: AddToSetOperator,
    $pop: PopOperator,
    $pull: PullOperator,
    $push: PushOperator,
    $currentDate: CurrentDateOperator,
    $bit: BitOperator,
}>

/**
 *
 */
export default class PowerAssign {

  /**
   *
   */
  static assign<T: Restorable>(obj: T, ops: Operators): T {
    let updatedObj: T = obj
    const operatorNames = Object.keys(ops)

    for (const operatorName of operatorNames) {
      switch (operatorName) {

        case '$inc':
          if (ops.$inc == null) break // for flowtype checking...
          updatedObj = this.$inc(updatedObj, ops.$inc)
          break

        case '$set':
          if (ops.$set == null) break // for flowtype checking...
          updatedObj = this.$set(updatedObj, ops.$set)
          break

        case '$min':
          if (ops.$min == null) break // for flowtype checking...
          updatedObj = this.$min(updatedObj, ops.$min)
          break

        case '$max':
          if (ops.$max == null) break // for flowtype checking...
          updatedObj = this.$max(updatedObj, ops.$max)
          break

        case '$mul':
          if (ops.$mul == null) break // for flowtype checking...
          updatedObj = this.$mul(updatedObj, ops.$mul)
          break

        case '$addToSet':
          if (ops.$addToSet == null) break // for flowtype checking...
          updatedObj = this.$addToSet(updatedObj, ops.$addToSet)
          break

        case '$pop':
          if (ops.$pop == null) break // for flowtype checking...
          updatedObj = this.$pop(updatedObj, ops.$pop)
          break

        case '$pull':
          if (ops.$pull == null) break // for flowtype checking...
          updatedObj = this.$pull(updatedObj, ops.$pull)
          break

        case '$push':
          if (ops.$push == null) break // for flowtype checking...
          updatedObj = this.$push(updatedObj, ops.$push)
          break

        case '$currentDate':
          if (ops.$currentDate == null) break // for flowtype checking...
          updatedObj = this.$currentDate(updatedObj, ops.$currentDate)
          break

        case '$bit':
          if (ops.$bit == null) break // for flowtype checking...
          updatedObj = this.$bit(updatedObj, ops.$bit)
          break

        case '$rename':
        case '$setOnInsert':
        case '$unset':
          throw new Error(`The given operator "${operatorName}" is not implemented yet.`)

        default:
          throw new Error(`Invalid operator: "${operatorName}"`)
      }
    }

    const Constructor = obj.constructor
    return (Constructor === Object) ? updatedObj : new Constructor(updatedObj)
  }

  /**
   *
   */
  static $set<T: Restorable>(obj: T, setOp: SetOperator): T {
    let updatedObj = obj
    Object.keys(setOp).forEach(dnStr => {
      updatedObj = this.setValue(updatedObj, dnStr, setOp[dnStr])
    })
    return updatedObj
  }


  /**
   *
   */
  static $inc<T: Restorable>(obj: T, incOp: IncOperator): T {
    const valuesToSet = {}

    Object.keys(incOp).forEach(dnStr => {
      const currentVal = this.getValue(obj, dnStr)
      const inc = incOp[dnStr]
      valuesToSet[dnStr] = currentVal + inc
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $min<T: Restorable>(obj: T, minOp: MinOperator): T {
    const valuesToSet = {}

    Object.keys(minOp).forEach(dnStr => {
      const currentVal = this.getValue(obj, dnStr)
      const newVal = minOp[dnStr]
      if (newVal < currentVal) {
        valuesToSet[dnStr] = newVal
      }
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $max<T: Restorable>(obj: T, maxOp: MaxOperator): T {
    const valuesToSet = {}

    Object.keys(maxOp).forEach(dnStr => {
      const currentVal = this.getValue(obj, dnStr)
      const newVal = maxOp[dnStr]
      if (newVal > currentVal) {
        valuesToSet[dnStr] = newVal
      }
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $mul<T: Restorable>(obj: T, mulOp: MulOperator): T {
    const valuesToSet = {}

    Object.keys(mulOp).forEach(dnStr => {
      const currentNum = this.getValue(obj, dnStr)
      if (currentNum == null) {
        throw Error('operand must not be null')
      }
      valuesToSet[dnStr] = currentNum * mulOp[dnStr]
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $addToSet<T: Restorable>(obj: T, addToSetOp: AddToSetOperator): T {
    const valuesToSet = {}

    Object.keys(addToSetOp).forEach(dnStr => {
      let arr: ?Array<any> = this.getValue(obj, dnStr)
      if (arr == null) {
        arr = [] // If the field is absent, empty array is set.
      }
      if (!Array.isArray(arr)) {
        throw new Error(`"$push" operator must be applied to an array. Dot notation: "${dnStr}".`)
      }
      let modifier = addToSetOp[dnStr]

      if (modifier.$each == null) {
        modifier = { $each: [modifier] }
      }
      // $FlowIssue(arr-is-Array)
      const newArr = modifier.$each.filter(element => !arr.some(arrEl => equal(arrEl, element)))
      valuesToSet[dnStr] = arr.concat(newArr)
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $pop<T: Restorable>(obj: T, popOp: PopOperator): T {
    const valuesToSet = {}

    Object.keys(popOp).forEach(dnStr => {
      let arr: ?Array<any> = this.getValue(obj, dnStr).slice()
      if (arr == null) {
        arr = [] // If the field is absent, empty array is set.
      }
      if (!Array.isArray(arr)) {
        throw new Error(`"$push" operator must be applied to an array. Dot notation: "${dnStr}".`)
      }
      if (popOp[dnStr] === 1) {
        arr.pop()
      } else {
        arr.shift()
      }
      valuesToSet[dnStr] = arr
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $pull<T: Restorable>(obj: T, pullOp: PullOperator): T {
    const valuesToSet = {}

    Object.keys(pullOp).forEach(dnStr => {
      let arr: ?Array<any> = this.getValue(obj, dnStr)
      if (arr == null) {
        return // If the field is absent, no operations will be executed
      }
      if (!Array.isArray(arr)) {
        throw new Error(`"$pull" operator must be applied to an array. Dot notation: "${dnStr}".`)
      }
      valuesToSet[dnStr] = QueryOperation.findInArrayByQuery(arr, pullOp[dnStr])
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $push<T: Restorable>(obj: T, pushOp: PushOperator): T {
    const valuesToSet = {}

    Object.keys(pushOp).forEach(dnStr => {
      let arr: ?Array<any> = this.getValue(obj, dnStr)
      if (arr == null) {
        arr = [] // If the field is absent, empty array is set.
      }
      if (!Array.isArray(arr)) {
        throw new Error(`"$push" operator must be applied to an array. Dot notation: "${dnStr}".`)
      }
      let modifier: PushModifier = pushOp[dnStr]

      // Is type of newVal PushModifier or just the value?
      if (modifier.$each == null) {
        modifier = { $each: [modifier] }
      }

      let position = (modifier.$position != null) ? modifier.$position : arr.length
      let newArr = arr.slice()
      newArr.splice(position, 0, ...modifier.$each)
      if (modifier.$sort != null) {
        const sortDnStrs = Object.keys(modifier.$sort)
        newArr.sort((a, b) => {
          for (const sortDnStr of sortDnStrs) {
            const valA = a[sortDnStr]
            const valB = b[sortDnStr]
            if (valA !== valB) {
              // $FlowIssue($sort-is-not-null)
              const direction = modifier.$sort[sortDnStr]
              return valA > valB ? direction : (direction ^ -1) + 1
            }
          }
          return 0
        })
      }
      if (modifier.$slice != null) {
        newArr = newArr.slice(0, modifier.$slice)
      }
      valuesToSet[dnStr] = newArr
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $currentDate<T: Restorable>(obj: T, curDateOp: CurrentDateOperator): T {
    const valuesToSet = {}

    Object.keys(curDateOp).forEach(dnStr => {
      let typeSpecification = curDateOp[dnStr]

      if (typeSpecification === true) {
        typeSpecification = { $type: 'date'}
      }
      const now = new Date()
      valuesToSet[dnStr] = typeSpecification.$type === 'date' ? now : now.getTime()
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $bit<T: Restorable>(obj: T, bitOp: BitOperator): T {
    const valuesToSet = {}

    Object.keys(bitOp).forEach(dnStr => {
      const currentNum = this.getValue(obj, dnStr) || 0 // If the field is absent, 0 is set.
      const logicalOperator = Object.keys(bitOp[dnStr])[0]
      // $FlowIssue(return-number)
      const operand: number = bitOp[dnStr][logicalOperator]
      switch (logicalOperator) {
        case 'and':
          valuesToSet[dnStr] = currentNum & operand
          break
        case 'or':
          valuesToSet[dnStr] = currentNum | operand
          break
        case 'xor':
          valuesToSet[dnStr] = currentNum ^ operand
          break
      }
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static setValue<T: Restorable>(obj: T, dnStr: DotNotationString, value: any): T {
    const revObjsToBeAssigned = this.getObjectsToBeAssigned(obj, dnStr).reverse()
    const revKeys = dnStr.split('.').reverse()
    // assert(objsToBeAssigned.length === keys.length)
    // $FlowIssue(return-T)
    return revKeys.reduce((newValue, key, i) =>
      // $FlowIssue(reduce-first-argument-type)
      Object.assign({}, revObjsToBeAssigned[i], { [key]: newValue })
    , value)
  }


  /**
   *
   */
  static getObjectsToBeAssigned(obj, dnStr): Array<Restorable> {
    const ret = [obj]
    const keys = dnStr.split('.')
    keys.pop()
    let currentObj = obj
    for (const key of keys) {
      currentObj = currentObj[key]
      ret.push(currentObj)
    }
    return ret
  }

  /**
   *
   */
  static getValue(obj: Restorable, dnStr: DotNotationString): any {
    return dnStr.split('.').reduce((currentObj, key) => currentObj[key], obj)
  }
}

/**
 *
 */
export function assign<T: Restorable>(obj: T, ops: Operators): T {
  return PowerAssign.assign(obj, ops)
}
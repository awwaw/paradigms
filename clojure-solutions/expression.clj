(def constant constantly)

(defn variable [var-name]
  (fn [values]
    (values var-name)))

(defn create-operation [operation]
  (fn [& arguments]
    (fn [values]
      (apply operation (mapv (fn [operand] (operand values)) arguments)))))

(def divide (create-operation
             (fn
               ([arg] (/ 1.0 (double arg)))
               ([arg & args] (/ (double arg) (apply * args))))))

(def add (create-operation +'))
(def subtract (create-operation -'))
(def multiply (create-operation *'))

(def negate (create-operation -))

; :NOTE: naming
(defn mean [& args]
  (/ (apply + (mapv #(* % %) args)) (count args)))

(def meansq (create-operation mean))

(defn number-rms [& args]
  (Math/sqrt (apply mean args)))

(def rms (create-operation number-rms))

(def operations
  {'+ add
   '- subtract
   '* multiply
   '/ divide
   'negate negate
   'meansq meansq
   'rms rms})

(defn createParser [constant-function variable-function operations]
  (letfn [(parse [token]
            (cond
              (number? token) (constant-function (double token))
              (symbol? token) (variable-function (str token))
              (list? token) (apply (operations (first token)) (mapv parse (rest token)))))]
    (comp parse read-string)))

(def parseFunction (createParser constant variable operations))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(declare ZERO ONE)

(defn evaluate [this values] (.evaluate this values))
(defn toString [this] (.toString this))
(defn diff [this variable] (.diff this variable))

(definterface Expression
  (^Number evaluate [values])
  (^String toString [])
  (^user.Expression diff [x]))

(deftype ClassConstant [value]
  Expression
  (evaluate [this values] value)
  (toString [this] (str value))
  (diff [this nm] ZERO))

(def ZERO (ClassConstant. 0))
(def ONE (ClassConstant. 1))

(deftype ClassVariable [variable-name]
  Expression
  (evaluate [this values] (get values variable-name))
  (toString [this] variable-name)
  (diff [this diff-name]
    (if (= diff-name variable-name) ONE ZERO)))

(defn operate [operation arguments values]
  (apply operation (mapv #(evaluate % values) arguments)))

(defn op-to-string [symbol args]
  (str "(" symbol " " (clojure.string/join " " (mapv #(toString %) args)) ")"))

(deftype ClassAdd [args]
  Expression
  (evaluate [this values] (operate + args values))
  (toString [this] (op-to-string "+" args))
  (diff [this diff-name]
    (ClassAdd. (mapv #(.diff % diff-name) args))))

(deftype ClassSubtract [args]
  Expression
  (evaluate [this values] (operate - args values))
  (toString [this] (op-to-string "-" args))
  (diff [this diff-name]
    (ClassSubtract. (mapv #(.diff % diff-name) args))))

(declare Add Subtract Multiply Divide Negate Exp Sumexp)

(deftype ClassMultiply [args]
  Expression
  (evaluate [this values] (operate * args values))
  (toString [this] (op-to-string "*" args))
  (diff [this diff-name]
    (ClassAdd. (mapv (fn [index function]
                       (ClassMultiply. (assoc (vec args) index (diff function diff-name))))
                     (range (count args)) args))))

(deftype ClassDivide [args]
  Expression
  (evaluate [this values] (operate (fn
                                     ([arg] (/ 1.0 (double arg)))
                                     ([arg & args] (/ (double arg) (apply * args)))) args values))
  (toString [this] (op-to-string "/" args))
  (diff [this diff-name]
        (if (== (count args) 1) 
          (Multiply (diff (first args) diff-name) (Negate (Divide ONE (Multiply (first args) (first args)))))
          (Divide 
           (Subtract 
            (Multiply 
             (diff (first args) diff-name)
             (ClassMultiply. (rest args)))
            (Multiply
             (first args)
             (diff (ClassMultiply. (rest args)) diff-name)
             )
            )
           (Multiply 
            (ClassMultiply. (rest args))
            (ClassMultiply. (rest args))))
          )
        )
  )

(deftype ClassNegate [args]
  Expression
  (evaluate [this values] (operate - args values))
  (toString [this] (op-to-string "negate" args))
  (diff [this diff-name] 
    (Negate (diff (first args) diff-name))))

(deftype ClassExp [args]
  Expression
  (evaluate [this values] (operate #(Math/exp %) args values))
  (toString [this] (op-to-string "exp" args))
  (diff [this diff-name]
    (Multiply (diff (first args) diff-name))))

(defn Exp [& args] (ClassExp. args))

(deftype ClassSumExp [args]
  Expression
  (evaluate [this values] (apply + (mapv (comp #(Math/exp %) #(evaluate % values)) args)))
  (toString [this] (op-to-string "sumexp" args))
  (diff [this diff-name]
    (ClassAdd. (mapv (fn [arg] (Multiply (diff arg diff-name) (Exp arg))) args))))

(deftype ClassLSE [args]
  Expression
  (evaluate [this values] (#(Math/log %) (evaluate (ClassSumExp. args) values)))
  (toString [this] (op-to-string "lse" args))
  (diff [this diff-name]
    (Multiply (diff (ClassSumExp. args) diff-name) (Divide ONE (ClassSumExp. args)))))

(defn Constant [value] (ClassConstant. value))
(defn Variable [name] (ClassVariable. name))
(defn Add [& args] (ClassAdd. args))
(defn Subtract [& args] (ClassSubtract. args))
(defn Multiply [& args] (ClassMultiply. args))
(defn Divide [& args] (ClassDivide. args))
(defn Negate [& args] (ClassNegate. args))
(defn Sumexp [& args] (ClassSumExp. args))
(defn LSE [& args] (ClassLSE. args))

(def object-operations 
  {
   '+ Add
   '- Subtract
   '* Multiply
   '/ Divide
   'negate Negate
   'sumexp Sumexp
   'lse LSE
  })

(def parseObject (createParser Constant Variable object-operations))


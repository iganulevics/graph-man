package com.graphman.model;

import java.util.ArrayList;
import java.util.List;

public class GraphQLSchema {

    private List<GraphQLType> types = new ArrayList<>();
    private String queryTypeName;
    private String mutationTypeName;
    private String subscriptionTypeName;

    public List<GraphQLType> getTypes() {
        return types;
    }

    public void setTypes(List<GraphQLType> types) {
        this.types = types;
    }

    public String getQueryTypeName() {
        return queryTypeName;
    }

    public void setQueryTypeName(String queryTypeName) {
        this.queryTypeName = queryTypeName;
    }

    public String getMutationTypeName() {
        return mutationTypeName;
    }

    public void setMutationTypeName(String mutationTypeName) {
        this.mutationTypeName = mutationTypeName;
    }

    public String getSubscriptionTypeName() {
        return subscriptionTypeName;
    }

    public void setSubscriptionTypeName(String subscriptionTypeName) {
        this.subscriptionTypeName = subscriptionTypeName;
    }

    public static class GraphQLType {
        private String name;
        private String kind;
        private String description;
        private List<GraphQLField> fields = new ArrayList<>();
        private List<GraphQLEnumValue> enumValues = new ArrayList<>();
        private List<GraphQLInputField> inputFields = new ArrayList<>();

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public List<GraphQLField> getFields() {
            return fields;
        }

        public void setFields(List<GraphQLField> fields) {
            this.fields = fields;
        }

        public List<GraphQLEnumValue> getEnumValues() {
            return enumValues;
        }

        public void setEnumValues(List<GraphQLEnumValue> enumValues) {
            this.enumValues = enumValues;
        }

        public List<GraphQLInputField> getInputFields() {
            return inputFields;
        }

        public void setInputFields(List<GraphQLInputField> inputFields) {
            this.inputFields = inputFields;
        }
    }

    public static class GraphQLField {
        private String name;
        private String description;
        private String typeName;
        private boolean isNonNull;
        private boolean isList;
        private List<GraphQLArgument> args = new ArrayList<>();

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getTypeName() {
            return typeName;
        }

        public void setTypeName(String typeName) {
            this.typeName = typeName;
        }

        public boolean isNonNull() {
            return isNonNull;
        }

        public void setNonNull(boolean nonNull) {
            isNonNull = nonNull;
        }

        public boolean isList() {
            return isList;
        }

        public void setList(boolean list) {
            isList = list;
        }

        public List<GraphQLArgument> getArgs() {
            return args;
        }

        public void setArgs(List<GraphQLArgument> args) {
            this.args = args;
        }
    }

    public static class GraphQLArgument {
        private String name;
        private String description;
        private String typeName;
        private boolean isNonNull;
        private String defaultValue;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getTypeName() {
            return typeName;
        }

        public void setTypeName(String typeName) {
            this.typeName = typeName;
        }

        public boolean isNonNull() {
            return isNonNull;
        }

        public void setNonNull(boolean nonNull) {
            isNonNull = nonNull;
        }

        public String getDefaultValue() {
            return defaultValue;
        }

        public void setDefaultValue(String defaultValue) {
            this.defaultValue = defaultValue;
        }
    }

    public static class GraphQLEnumValue {
        private String name;
        private String description;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }

    public static class GraphQLInputField {
        private String name;
        private String description;
        private String typeName;
        private boolean isNonNull;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getTypeName() {
            return typeName;
        }

        public void setTypeName(String typeName) {
            this.typeName = typeName;
        }

        public boolean isNonNull() {
            return isNonNull;
        }

        public void setNonNull(boolean nonNull) {
            isNonNull = nonNull;
        }
    }
}
